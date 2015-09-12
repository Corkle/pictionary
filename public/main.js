var pictionary = function() {
    var socket = io();

    var playing = false;
    var isDrawer = false;
    var drawing = false;
    var drawerID;
    var playerName;
    var clientSocketID;
    var canvasXMult = 4;
    var canvasYMult = 3;
    var canvasX, canvasY;

    var typingTimer, guessTimer;
    var doneTypingInterval = 3000;
    var guessInterval = 8000;
    var isTyping = false;
    var guessLock = false;

    //--------- DOM Element variables ---------

    var guessButton = $('#submit-guess button');
    var guessBox = $('#submit-guess input');
    var guessList = $('#guess-list');
    var sendMessageBtn = $('#send-msg-btn');
    var messageBox = $('#msg');
    var chatLog = $('#chat-log');
    var typingStatus = $('#chat-typing-status');
    var userList = $('#users');
    var userListHeading = $('#user-count');
    var canvas = $('canvas');
    var context = canvas[0].getContext('2d');
    // var context = canvas[0].getContext('2d');
    // canvas[0].width = canvas[0].offsetWidth;
    // canvas[0].height = canvas[0].offsetHeight;
    var clrCanvasBtn = $('#clear-canvas-btn');
    var guesserCanvasLbl = $('#guesser-canvas-label');
    var wordLabel = $('#word-label');


    //--------- Initialize Page ---------

    resizeCanvas();
    $('#drawer-canvas-heading').hide();
    $('#game-content').hide();
    $('#name').focus();
    $('form').submit(function(event) {
        event.preventDefault();
    });

    //--------- Connect to server ---------

    socket.on('connect', function() {
        guessButton.prop('disabled', false);
        sendMessageBtn.prop('disabled', false);

        // if previously playing session, rejoin with same name
        if (playing) {
            socket.emit('join', playerName);
        }
    })

    socket.on('identify-client', function(clientID) {
        clientSocketID = clientID;
    })

    //--------- Join game session ---------

    $('#join').click(function() {
        playerName = $('#name').val();
        if (playerName != "") {
            socket.emit('join', playerName);
            $('#login').detach();
            $('#game-content').show();
            canvas.focus();
            playing = true;
        }
    });

    $('#name').on('keydown', function(event) {
        if (event.keyCode != 13) {
            return;
        }
        $('#join').click();
    });

    //--------- Disconnect from server ---------    

    socket.on('disconnect', function() {
        addMessage('--- You have disconnected from the server ---');
        guessButton.prop('disabled', true);
        sendMessageBtn.prop('disabled', true);
    })

    //--------- Users panel ---------

    socket.on('update-users', function(users) {
        if (drawerID !== users.drawer) {
            updateDrawer(users.drawer, users.players[users.drawer]);
        }

        userList.empty();
        $.each(users.players, function(clientID, name) {
            addUser(clientID, name);
        });
        userListHeading.html('Users: ' + Object.keys(users.players).length);
    })

    function updateDrawer(id, name) {
        drawerID = id;
        clearCanvas();
        guessList.empty();
        if (id == clientSocketID) {
            isDrawer = true;
            $('#guesser-canvas-heading').hide();
            $('#drawer-canvas-heading').show();
            $('#guess-panel .panel-footer').addClass('invisible');
            // guessButton.prop('disabled', true);
            // guessBox.prop('disabled', true);
            addMessage('<span class="glyphicon glyphicon-pencil" aria-hidden="true"></span>  You are the drawer')
        }
        else {
            isDrawer = false;
            $('#drawer-canvas-heading').hide();
            $('#guesser-canvas-heading').show();
            $('#guess-panel .panel-footer').removeClass('invisible');
            // guessButton.prop('disabled', false);
            // guessBox.prop('disabled', false);
            addMessage(name + ' is the drawer.');
            guesserCanvasLbl.text(name + ' is drawing');
        }
    }

    function addUser(id, name) {
        var userItem = $('.templates .user-item').clone();

        if (id == clientSocketID) {
            userItem.html('<span class="label label-success">' + name + '</span>');
        }
        else {
            userItem.html(name);
        }

        if (id == drawerID) {
            userItem.append('<span class="glyphicon glyphicon-pencil" aria-hidden="true"></span>')
        }

        userList.append(userItem);
    }


    //--------- Messaging panel ---------

    sendMessageBtn.on('click', function() {
        var message = messageBox.val();
        addMessage('You: ' + message);
        socket.emit('chat-message', message);
        messageBox.val('').focus();
        doneTyping();
    })

    messageBox.on('keydown', function(event) {
            // Enter key pressed
            if (event.keyCode == 13) {
                sendMessageBtn.click();
                return;
            }
            // tell server that user started typing
            if (!isTyping) {
                socket.emit('start-typing');
                isTyping = true;
            }
        })
        .on('keyup', function(event) {
            if (isTyping) {
                clearTimeout(typingTimer);
                typingTimer = setTimeout(doneTyping, doneTypingInterval);
            }
        })

    socket.on('update-chat', function(message) {
        if (playing) {
            addMessage(message);
        }
    })

    socket.on('update-typing', function(usersTyping) {
        var typersMessage = '';
        // remove this client from usersTyping
        delete usersTyping[clientSocketID];
        var typersCount = Object.keys(usersTyping).length;
        if (typersCount > 1) {
            typersMessage = typersCount + ' users are typing...';
        }
        else if (typersCount == 1) {
            var typerID = Object.keys(usersTyping)[0]
            typersMessage = usersTyping[typerID] + ' is typing...';
        }
        typingStatus.html(typersMessage);
    })

    function addMessage(message) {
        chatLog.append('<div>' + message + '</div>');
        scrollToBottom(chatLog);
    }

    function doneTyping() {
        socket.emit('done-typing');
        clearTimeout(typingTimer);
        isTyping = false;
    }


    //--------- Drawing canvas ---------

    function draw(position) {
        context.beginPath();
        context.arc(position.x * canvasX, position.y * canvasY, 6, 0, 2 * Math.PI);
        context.fill();
    };

    function clearCanvas() {
        context.clearRect(0, 0, canvas[0].width, canvas[0].height);
    };

    function resizeCanvas() {

        // Copy existing drawing to tmp canvas
        if (playing) {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = canvas[0].width;
            tmpCanvas.height = canvas[0].height;
            var tmpContext = tmpCanvas.getContext('2d');
            tmpContext.drawImage(canvas[0], 0, 0);
        }
        
        // Modify existing canvas
        canvas.height(canvas.width() * canvasYMult / canvasXMult);
        guessList.height(canvas.height() - 55);
        canvas[0].width = canvas[0].offsetWidth;
        canvas[0].height = canvas[0].offsetHeight;
        canvasX = canvas.width();
        canvasY = canvas.height();

        // Paste existing drawing on new canvas size
        if (tmpCanvas) {
            context.drawImage(tmpCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height, 0, 0, canvas[0].width, canvas[0].height);
        }
    };

    canvas.on('mousemove', function(event) {
            if (drawing && isDrawer) {
                var offset = canvas.offset();
                var position = {
                    x: (event.pageX - offset.left) / canvasX,
                    y: (event.pageY - offset.top) / canvasY
                };
                draw(position);
                socket.emit('draw', position);
            }
        })
        .on('mousedown', function() {
            event.preventDefault();
            drawing = true;
        })
        .on('mouseup', function() {
            drawing = false;
        })


    socket.on('update-canvas', function(position) {
        draw(position);
    })

    socket.on('clear-canvas', function() {
        clearCanvas();
    })

    socket.on('new-word', function(word) {
        wordLabel.text(word.toUpperCase());
    })

    clrCanvasBtn.on('click', function(event) {
        if (isDrawer) {
            socket.emit('clear-canvas');
        }
    })


    //--------- Guess panel ---------

    socket.on('showGuess', function(guess) {
        guessList.append('<li>' + guess.toCapitalCase() + '</li>');
        scrollToBottom(guessList);
    })

    guessButton.on('click', function(event) {
        var guess = guessBox.val();
        if (guess == '') {
            return;
        }
        socket.emit('guess', guess.toLowerCase());
        guessBtnLockout();
        guessBox.val('').focus();
    })

    guessBox.on('keydown', function(event) {
        // Enter key pressed
        if (event.keyCode == 13 && !guessLock) {
            guessButton.click();
            return;
        }
    });

    function guessBtnLockout() {
        guessButton.prop('disabled', true);
        guessLock = true;

        var secLeft = Math.ceil(guessInterval / 1000);
        guessButton.html(secLeft);

        guessTimer = setInterval(function() {
            secLeft -= 1;
            if (secLeft <= 0) {
                guessButton.html('Guess');
                guessButton.prop('disabled', false);
                guessLock = false;
                clearInterval(guessTimer);
                return;
            }
            guessButton.html(secLeft);
        }, 1000);
    }

    //--------- Global functions ---------

    window.addEventListener("resize", resizeCanvas, false);

    function scrollToBottom(elem) {
        elem.animate({
            scrollTop: $(elem)[0].scrollHeight
        }, 500);
    }

    String.prototype.toCapitalCase = function() {
        var re = /\s/;
        var words = this.split(re);
        re = /(\S)(\S+)/;
        for (i = words.length - 1; i >= 0; i--) {
            re.exec(words[i]);
            words[i] = RegExp.$1.toUpperCase() + RegExp.$2.toLowerCase();
        }
        return words.join(' ');
    }

    function DEBUG(item) {
        console.log(item);
    }
}

$(document).ready(function() {
    pictionary();
})



//  TODO:  
//         private messaging
//         handle disconnect and reconnects
//         timers
