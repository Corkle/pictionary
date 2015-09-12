var http = require('http');
var express = require('express');
var socket_io = require('socket.io');

var app = express();
app.use(express.static('public'));

var server = http.Server(app);
var io = socket_io(server);

var users = {
    drawer: null,
    players: {},
    typers: {}
};

var WORDS = [
    "word", "letter", "number", "person", "pen", "class", "people",
    "sound", "water", "side", "place", "man", "men", "woman", "women", "boy",
    "girl", "year", "day", "week", "month", "name", "sentence", "line", "air",
    "land", "home", "hand", "house", "picture", "animal", "mother", "father",
    "brother", "sister", "world", "head", "page", "country", "question",
    "answer", "school", "plant", "food", "sun", "state", "eye", "city", "tree",
    "farm", "story", "sea", "night", "day", "life", "north", "south", "east",
    "west", "child", "children", "example", "paper", "music", "river", "car",
    "foot", "feet", "book", "science", "room", "friend", "idea", "fish",
    "mountain", "horse", "watch", "color", "face", "wood", "list", "bird",
    "body", "dog", "family", "song", "door", "product", "wind", "ship", "area",
    "rock", "order", "fire", "problem", "piece", "top", "bottom", "king", "space"
];
var unusedWords = [];
var currentWord;

function newDrawer(id) {
    if (id) {
        users.drawer = id;
    }
    else {

        if (Object.keys(users.players).length == 0) {
            console.log('No players available to designate drawer');
            return;
        }

        var oldDrawer = users.drawer;
        var availablePlayers = users.players;
        delete availablePlayers[oldDrawer];
        users.drawer = Object.keys(availablePlayers)[randomInt(0, Object.keys(availablePlayers).length)];
    }

    newWord();
    io.to(users.drawer).emit('new-word', currentWord);
    io.emit('update-users', users);
    console.log(users.players[users.drawer] + ' is drawing: ' + currentWord);
};

function newWord() {
    if (unusedWords.length === 0) {
        console.log('Filling word bank');
        unusedWords = WORDS.slice(0);
    }

    var removed = unusedWords.splice(randomInt(0, unusedWords.length), 1);
    currentWord = removed[0];
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

io.on('connection', function(socket) {
    console.log('Client connected');

    socket.on('join', function(name) {
        console.log(name + ' has joined');
        users.players[socket.id] = name;
        socket.emit('identify-client', socket.id);
        socket.emit('update-chat', 'You have joined the game.');
        socket.broadcast.emit('update-chat', name + ' has joined the game.');

        if (!users.drawer) {
            newDrawer(socket.id);
        }

        io.emit('update-users', users);
    })

    socket.on('disconnect', function() {
        if (users.players[socket.id]) {
            console.log(users.players[socket.id] + ' has disconnected');
            socket.broadcast.emit('update-chat', users.players[socket.id] + ' has left the game.');
            delete users.players[socket.id];
            delete users.typers[socket.id];

            if (!users.players[users.drawer]) {
                users.drawer = null;
                newDrawer();
            }
            socket.broadcast.emit('update-users', users);
        }
    })

    socket.on('draw', function(position) {
        socket.broadcast.emit('update-canvas', position);
    })

    socket.on('clear-canvas', function() {
        io.sockets.emit('clear-canvas');
    })

    socket.on('guess', function(guess) {
        console.log('Guess made by ' + users.players[socket.id] + ':', guess);
        if (guess == currentWord) {
            console.log('Word correctly guessed.');
            socket.emit('update-chat', 'You correctly guessed <span class="label label-success">' + guess + '</span>');
            socket.broadcast.emit('update-chat', users.players[socket.id] + ' correctly guessed <span class="label label-success">' + guess + '</span>');
            newDrawer(socket.id);
        }
        else {
            io.sockets.emit('showGuess', guess);
            socket.emit('update-chat', 'You guessed: ' + guess);
            socket.broadcast.emit('update-chat', users.players[socket.id] + ' guessed: ' + guess);
        }
    })

    socket.on('chat-message', function(message) {
        console.log('Received message from ' + users.players[socket.id] + ':', message);
        socket.broadcast.emit('update-chat', users.players[socket.id] + ': ' + message);
    })

    socket.on('start-typing', function() {
        users.typers[socket.id] = users.players[socket.id];
        io.emit('update-typing', users.typers);
    })

    socket.on('done-typing', function() {
        delete users.typers[socket.id];
        io.emit('update-typing', users.typers);
    })
});

server.listen(8080);