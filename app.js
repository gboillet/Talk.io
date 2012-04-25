var app = require('http').createServer(handler)
  ,io = require('socket.io').listen(app)
  ,fs = require('fs')
  
if(process.env.VMC_APP_PORT)
{
	io.set('transports', [
	//'websocket',
	'flashsocket',
	'htmlfile',
	'xhr-polling',
	'jsonp-polling'
	]);
}

app.listen(process.env.VCAP_APP_PORT || 3000);

io.configure(function ()
{
	io.set("authorization", function (handshakeData, callback)
	{
		console.log("handshakeData----->"+handshakeData);
		handshakeData.room = "none";
		handshakeData.username = "none";
		callback(null, true);
	});
});

function handler (req, res)
{
	console.log("Requested---->"+req.url);
	
	if(req.url == "/")
	{
		fs.readFile(__dirname+"/homepage.html",
		function (err, data)
		{
			if(err) 
			{
				res.writeHead(500);
				return res.end('Error loading '+req.url);
			}

			res.writeHead(200);
			res.end(data);
		});
	}
	else if(req.url.indexOf("/room/") != -1)
	{
		fs.readFile(__dirname+"/index.html",
		function (err, data)
		{
			if(err) 
			{
				res.writeHead(500);
				return res.end('Error loading '+req.url);
			}

			res.writeHead(200);
			res.end(data);
		});
	}
	else
	{
		//fs.readFile(__dirname + '/index.html',
		fs.readFile(__dirname+req.url,
		
		function (err, data)
		{
			if(err) 
			{
				res.writeHead(500);
				return res.end('Error loading '+req.url);
			}

			res.writeHead(200);
			res.end(data);
		});
	}
}

//Usernames which are currently connected to the chat
var usernames = new Array();

//Rooms which are currently available in chat
var rooms = ['room1'];

function alreadyExistsUser(username)
{
	var i=0;
	
	for(i=0; i<usernames.length; i++)
	{
		if(usernames[i] == username)
			return true;
	}
	return false;
}

function alreadyExistsRoom(room)
{
	var i=0;
	
	for(i=0; i<rooms.length; i++)
	{
		if(rooms[i] == room)
			return true;
	}
	return false;
}

function deleteUser(username)
{
	var i=0;
	
	for(i=0; i<usernames.length; i++)
	{
		if(usernames[i] == username)
			usernames.splice(i, 1);
	}
}

io.sockets.on("connection", function (socket)
{
	socket.on("createRoom", function(roomName, callbackfn)
	{
		var response = {};

		if(alreadyExistsRoom(roomName) && roomName != "none") //none is a reserved roomName
			response.error = roomName+" already in use";
		else
		{
			rooms.push(roomName);
			response.ok = roomName+" is available";
		}
		callbackfn(response);
	});
	
	socket.on("adduser", function(username, room)
	{
		if(!alreadyExistsRoom(room))
			socket.emit("noRoom");
		else
		{
			if(socket.handshake.username != username)
			{
				if(alreadyExistsUser(username) || username == '')
					socket.emit("changeNick", username); //Warn the client to change his nick
				else
				{
					socket.username = username;
					socket.room = room;
					
					//Store the room name/username persistant way (test)
					socket.handshake.room = room;
					socket.handshake.username = username;
					
					//Add the user to users list
					usernames.push(username);
					
					//Send client to the room
					socket.join(room);
					
					socket.emit("updatechat", "Server", "you have connected to "+room, new Date());

					socket.broadcast.to(room).emit("updatechat", "Server", username+" has connected to this room", new Date());
					
					//Update list of users in chat, client-side
					socket.emit("updateusers", usernames);
					socket.broadcast.emit("updateusers", usernames);
					
					console.log("Users---->"+usernames);
				}
			}
		}
	});

	socket.on("sendchat", function (data, date)
	{
		//Broadcast the new message to the room, with a timetamp
		io.sockets.in(socket.room).emit("updatechat", socket.username, data, date);
	});
	
	socket.on("disconnect", function()
	{
		if(socket.handshake.username != "none")
		{
			console.log("------> disconnect");
			
			//Remove the username from the users list
			deleteUser(socket.handshake.username)
			
			socket.broadcast.emit("updateusers", usernames);
			
			console.log("Users---->"+usernames);
			
			socket.broadcast.emit("updatechat", "Server", socket.handshake.username+" has disconnected", new Date());
			socket.leave(socket.room);
		}
	});
});