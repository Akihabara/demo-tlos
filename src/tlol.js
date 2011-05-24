// ---
// Copyright (c) 2010 Francesco Cottone, http://www.kesiev.com/
// ---


// Game-specific

var maingame;
var tilemaps={};
var dialogues={};
var credits={};
var noface; // Is a fake "actor" in dialogues. The text is ever in the same place.
var audioserver;

// In games like Zelda, object are alive also outside of the screen.
// So, let's calculate a distance threshold from the camera
function objectIsAlive(th) {
	return trigo.getDistance(th,gbox.getCamera())<800;
}

function go() {
	gbox.setGroups(["background","player","bonus","foes","walls","playerbullets","foesbullets","sparks","foreground","gamecycle"]);
	gbox.setAudioChannels({bgmusic:{volume:0.8},sfx:{volume:1.0}});

	// player, walls, bullets and foes are under z-index layer
	gbox.setRenderOrder(["background",gbox.ZINDEX_LAYER,"sparks","foreground","gamecycle"]);

	maingame=gamecycle.createMaingame("gamecycle","gamecycle");

	// Title intro
	maingame.gameTitleIntroAnimation=function(reset) {
		if (reset) {
			gbox.playAudio("default-music");
			toys.resetToy(this,"rising");
		} else {
			gbox.blitFade(gbox.getBufferContext(),{alpha:1,color:"rgb(150,150,150)"});
			toys.logos.rising(this,"rising",{image:"logo",x:gbox.getScreenHW()-gbox.getImage("logo").hwidth,y:20,speed:1,gapx:250,reflex:0.1,audioreach:"coin"});
		}
	},

	// No level intro animation
	maingame.gameIntroAnimation=function() { return true; }

	// No end level animation
	maingame.endlevelIntroAnimation=function() { return true; }

	// Level animation
	maingame.levelIntroAnimation=function(reset) {
		if (reset) {
			toys.resetToy(this,"default-blinker");
		} else {
			gbox.blitFade(gbox.getBufferContext(),{alpha:1});
			return toys.text.fixed(this,"default-blinker",gbox.getBufferContext(),{font:"big",text:maingame.getNextLevel().label,valign:gbox.ALIGN_MIDDLE,halign:gbox.ALIGN_CENTER,dx:0,dy:0,dw:gbox.getScreenW(),dh:gbox.getScreenH(),time:50});
		}
	}

	// Game is ever over, if the player dies the first time. No life check, since is energy-based.
	maingame.gameIsOver=function() { return true; }

	// Game ending
	maingame.gameEndingIntroAnimation=function(reset){
		if (reset) {
			toys.resetToy(this,"intro-animation");
		} else {
			gbox.blitFade(gbox.getBufferContext(),{alpha:1});
			return toys.dialogue.render(this,"intro-animation",credits.titles);
		}
	}

	// Game events are decided by the map.
	maingame.gameEvents=function() {
		tilemaps.map.mapActions();
	}

	// Change level
	maingame.changeLevel=function(level) {
		// Cleanup the level
		gbox.trashGroup("playerbullets");
		gbox.trashGroup("foesbullets");
		gbox.trashGroup("foes");
		gbox.trashGroup("bonus");
		gbox.trashGroup("walls");
		gbox.purgeGarbage(); // Since we're starting, we can purge all now

		if (level==null)
			level={level:"begin",x:300,y:270,introdialogue:true}; // First stage

		// Dialogues are emptied - will be loaded by bundles. Cache is not needed - each bundle
		// Contains full dialogues for the floor.
		dialogues={};

		// Map data is wiped too. Will be loaded by loadBundle. Other data in tilemaps is
		// kept (i.e. quest status etc)
		delete tilemaps.map;

		// Here the map is loaded. During the load time, the game is still.
		gbox.addBundle({
			file:"resources/bundle-map-"+level.level+".js",
			onLoad:function(){ // This "onload" operation is triggered after everything is loaded.
				help.finalizeTilemap(tilemaps.map); // Finalize the map into the bundle
				gbox.createCanvas("tileslayer",{w:tilemaps.map.w,h:tilemaps.map.h}); // Prepare map's canvas
				gbox.blitTilemap(gbox.getCanvasContext("tileslayer"),tilemaps.map); // Render map on the canvas
				toys.topview.spawn(gbox.getObject("player","player"),{x:level.x,y:level.y}); // Displace player
				tilemaps.map.addObjects(); // Initialize map
				if (level.introdialogue) // Eventually starts intro dialogue.
			maingame.startDialogue("intro"); // game introduction, if needed
			}
		});
	}

	// Game initialization
	maingame.initializeGame=function() {
		// Prepare hud
		maingame.hud.setWidget("weapon",{widget:"radio",value:0,tileset:"items",frames:[0],dx:10,dy:10});
		maingame.hud.setWidget("health",{widget:"symbols",tiles:[3,2,1,0],minvalue:0,maxvalue:20,value:12-(maingame.difficulty*4),maxshown:4,tileset:"hud",emptytile:4,dx:40,dy:10,gapx:20,gapy:0});
		maingame.hud.setWidget("cash",{widget:"label",font:"small",value:0,minvalue:0,maxvalue:100,dx:gbox.getScreenW()-60,dy:gbox.getScreenH()-24,prepad:3,padwith:" ",clear:true});
		maingame.hud.setWidget("SMALLKEY",{widget:"label",font:"small",value:0,minvalue:0,maxvalue:999,dx:gbox.getScreenW()-60,dy:gbox.getScreenH()-43,prepad:3,padwith:" ",clear:true});
		maingame.hud.setWidget("BOSSKEY",{widget:"bool",value:0,tileset:"hud",frame:5,dx:gbox.getScreenW()-30,dy:gbox.getScreenH()-66}); // This is shown if value is true or >0

		maingame.hud.setWidget("lblkey",{widget:"blit",value:6,tileset:"hud",dx:gbox.getScreenW()-30,dy:gbox.getScreenH()-50});
		maingame.hud.setWidget("lblcoin",{widget:"blit",value:7,tileset:"hud",dx:gbox.getScreenW()-30,dy:gbox.getScreenH()-30});

		tilemaps={
			_defaultblock:100, // The block that is over the borders (a wall)
			queststatus:{} // Every step the player does, is marked here (opened doors, sections cleared etc)
		};

		gbox.addObject({
			id:"bg",
			group:"background",
			blit:function() {
				gbox.centerCamera(gbox.getObject("player","player"),{w:tilemaps.map.w,h:tilemaps.map.h});
				gbox.blit(gbox.getBufferContext(),gbox.getCanvas("tileslayer"),{dx:0,dy:0,dw:gbox.getScreenW(),dh:gbox.getScreenH(),sourcecamera:true});
			}
		});

		gbox.addObject({
			id:"player",
			group:"player",
			tileset:"player",
			zindex:0, // Needed for zindexed objects
			stilltimer:0, // is used to block the player while attacking (a la zelda!)
			invultimer:0, // Custom attribute. A timer that keep invulnerable.
			isPaused:false, // Pauses the player during dialogues, cutscenes etc.

			doPause:function(p) {
				this.isPaused=p;
			},

			initialize:function() {
			toys.topview.initialize(this,{
				haspushing:true,
				shadow:{tileset:"shadows",tile:0},
				frames:{
					standup:{ speed:1, frames:[0] },
					standdown:{ speed:1, frames:[3] },
					standleft:{ speed:1, frames:[6] },
					standright:{ speed:1, frames:[6] },
					movingup:{speed:3,frames:[0,1,0,2] },
					movingdown:{speed:3,frames:[3,4,3,5] },
					movingleft:{speed:3,frames:[6,7] },
					movingright:{speed:3,frames:[6,7] },
					pushingup:{speed:6,frames:[0,1,0,2] },
					pushingdown:{speed:6,frames:[3,4,3,5] },
					pushingleft:{speed:6,frames:[6,7] },
					pushingright:{speed:6,frames:[6,7] }
				}
			});
		},

		collisionEnabled:function() { // Disable collisions when the game is on hold, the player is dead or invulnerable
			return !maingame.gameIsHold()&&!this.killed&&!this.invultimer&&!this.isPaused;
		},

		hitByBullet:function(by) {
			if (this.collisionEnabled()) { // If collison are enabled...
				maingame.hud.addValue("health","value",-by.power); // Decrease power
				if (maingame.hud.getValue("health","value")<=0) // If dead..
					this.kill(); // Kill...
				else { // Else is just hit
					gbox.hitAudio("hurt");
					this.accz=-5; // A little jump...
					this.invultimer=30; // Stay invulnerable for a while...
					this.stilltimer=10; // Stay still for a while...
				}
				return by.undestructable; // Destroy or not a bullet (decided by the bullet itself)
			} else return true; // Bullets are ignored
		},

		kill:function(by){
			 gbox.hitAudio("die");
			 this.frame=8;
			 this.accz=-8;
			 maingame.addSmoke(this,"flame-red");
			 this.killed=true;
			 maingame.playerDied({wait:50});
		},

		attack:function() {
			gbox.hitAudio("sword");

			this.stilltimer=10; // Stay still for a while
			this.frame=(this.facing==toys.FACE_UP?9:(this.facing==toys.FACE_DOWN?10:11));

			switch (maingame.hud.getValue("weapon","value")) {
				case 0: { // Sword
					toys.topview.fireBullet("playerbullets",null,{
						fullhit:true,
						collidegroup:"foes",
						undestructable:true, // Custom attribute. Is not destroyed by the hitted object.
						power:1, // Custom attribute. Is the damage value of this weapon.
						from:this,
						sidex:this.facing,
						sidey:this.facing,
						tileset:((this.facing==toys.FACE_LEFT)||(this.facing==toys.FACE_RIGHT)?"lefthit":"uphit"),
						frames:{speed:1,frames:[0,1,2,3]},
						duration:4,
						acc:5,
						fliph:(this.facing==toys.FACE_RIGHT),
						flipv:(this.facing==toys.FACE_DOWN),
						angle:toys.FACES_ANGLE[this.facing]
					});
					break;
				}
				case 1: { // Arrows
					toys.topview.fireBullet("playerbullets",null,{
						_canhitswitch:true, // Arrows can hit switchs and turn them on
						fullhit:true,
						collidegroup:"foes",
						map:tilemaps.map, // Map is specified, since collides with walls
						mapindex:"map",
						defaulttile:tilemaps._defaultblock,
						undestructable:false, // Custom attribute. Is destroyed by the hitted object.
						power:2, // Custom attribute. Is the damage value of this weapon.
						from:this,
						sidex:this.facing,
						sidey:this.facing,
						tileset:((this.facing==toys.FACE_LEFT)||(this.facing==toys.FACE_RIGHT)?"leftarrow":"uparrow"),
						frames:{speed:1,frames:[0,1]},
						acc:5,
						fliph:(this.facing==toys.FACE_RIGHT),
						flipv:(this.facing==toys.FACE_DOWN),
						angle:toys.FACES_ANGLE[this.facing],
						spritewalls:"walls",
						gapy:8 // Avoid wall collision on start
					});
					break;
			   }
		   }
		},

		first:function() {
			if (this.stilltimer) this.stilltimer--;
			if (this.invultimer) this.invultimer--;

			// Counter
			this.counter=(this.counter+1)%60;
			if (this.stilltimer||maingame.gameIsHold()||this.isPaused||this.killed)
			    toys.topview.controlKeys(this,{}); // Stays still. No key is moving! :)
			else
			    toys.topview.controlKeys(this,{left:"left",right:"right",up:"up",down:"down"}); // Moves (if not attacking)

			toys.topview.handleAccellerations(this);
			toys.topview.handleGravity(this); // z-gravity
			toys.topview.applyForces(this); // Apply forces
			toys.topview.applyGravity(this); // z-gravity
			toys.topview.tileCollision(this,tilemaps.map,"map",tilemaps._defaultblock); // tile collisions
			toys.topview.floorCollision(this); // Collision with the floor (for z-gravity)
			toys.topview.spritewallCollision(this,{group:"walls"}); // Doors and tresaure chests are sprites that acts like a wall.
			toys.topview.adjustZindex(this);
			if (!this.stilltimer&&!this.killed) toys.topview.setFrame(this); // set the right animation frame (if not attacking)
			if (!this.stilltimer&&!this.isPaused&&!maingame.gameIsHold()&&!this.killed)
				if (gbox.keyIsHit("a"))
					this.attack();
				else if (gbox.keyIsHit("b")) {
					var ahead=toys.topview.getAheadPixel(this,{distance:5});
					ahead.group="walls";
					ahead.call="doPlayerAction";
					if (!toys.topview.callInColliding(this,ahead)) {// if any action is done
						if (maingame.hud.getValue("weapon","frames").length>1)
							gbox.hitAudio("default-menu-option");
						maingame.hud.addValue("weapon","value",1);
					}
				}
			},

			blit:function() {
				if ((this.invultimer%2)==0) {
					// Shadowed object. First draws the shadow...
					gbox.blitTile(gbox.getBufferContext(),{tileset:this.shadow.tileset,tile:this.shadow.tile,dx:this.x,dy:this.y+this.h-gbox.getTiles(this.shadow.tileset).tileh+4,camera:this.camera});
					// Then the object. Notes that the y is y+z to have the "over the floor" effect.
					gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y+this.z,camera:this.camera,fliph:this.fliph,flipv:this.flipv});
				 }
			 }
		});
	};

	// Add a bonus item. It jumps a while and then disappear.
	maingame.addBonus=function(x,y,type,id,expire) {
		var frames;

		switch (type) {
			case "coin": {frames={ standdown:{ speed:2, frames:[0,1,2,3,4,5] }  }; break } // Rotating coin
			case "arrow": {frames={ standdown:{ speed:3, frames:[6,7] }  }; break } // Blinking arrow icon
			case "SMALLKEY": {frames={ standdown:{ speed:3, frames:[8,9] }  }; break } // Blinking small key
			case "BOSSKEY": {frames={ standdown:{ speed:3, frames:[10,11] }  }; break } // Blinking small key
		}

		gbox.addObject(new Bonus(x,y,type,id,expire, frames));
	}

	// Changes a tile in the map. It also adds smoke if asked.
	maingame.setTileInMap=function(x,y,tile,smoke) {
		help.setTileInMap(gbox.getCanvasContext("tileslayer"),tilemaps.map,x,y,tile);
		if (smoke) {
			var ts=gbox.getTiles(tilemaps.map.tileset);
			gbox.hitAudio("explosion"); // Switch sound
			maingame.addSmoke({x:x*ts.tilew,y:y*ts.tilew,h:ts.tileh,w:ts.tilew,hh:ts.tilehh,hw:ts.tilehw,camera:true});
		}
	}

	// Add the "QUEST CLEAR" message
	maingame.addQuestClear=function(msg) {
		if (msg==null) gbox.hitAudio("default-menu-confirm"); // Switch sound
		toys.generate.sparks.popupText(gbox.getObject("player","player"),"sparks",null,{font:"big",jump:6,text:(msg==null?"QUEST CLEAR!":msg),keep:20});
	}

	// Add spreading smoke on an object
	maingame.addSmoke=function(ob,color) {
		// Since camera is not specified (will be into the initializator), is added on the spark instead from the created object
		toys.generate.sparks.simple(ob,"sparks",null,{camera:true,animspeed:2,accy:-3,accx:-3,tileset:(color==null?"flame-white":color)});
		toys.generate.sparks.simple(ob,"sparks",null,{camera:true,animspeed:2,accy:-3,accx:3,tileset:(color==null?"flame-white":color)});
		toys.generate.sparks.simple(ob,"sparks",null,{camera:true,animspeed:2,accy:3,accx:-3,tileset:(color==null?"flame-white":color)});
		toys.generate.sparks.simple(ob,"sparks",null,{camera:true,animspeed:2,accy:3,accx:3,tileset:(color==null?"flame-white":color)});
	}

	// Add a tresaure chest
	maingame.addChest=function(x,y,id,animated,cont,contid,expi) {
		var td=gbox.getTiles(tilemaps.map.tileset);
		var ob=gbox.addObject(new Chest(x,y,id,animated,cont,contid,expi,td));
		if (animated) maingame.addSmoke(ob);
	}

	// Add a door
	maingame.addDoor=function(id,tileset,x,y,animated,openwith) { // A door constructor. These doors opens shaking and smoking, a la Zelda
		var door=toys.topview.makedoor("walls",id,tilemaps.map,{whileMoving:function(){
			this.x+=(this.opencounter%2==0?-1:1)
			if (this.opencounter%5==0) {
				toys.generate.sparks.simple(this,"sparks",null,{alpha:0.7,gapy:this.hh,frames:{speed:4,frames:[3,2,1,2,3]},accy:-help.random(0,4),tileset:"flame-white"});
				toys.generate.sparks.simple(this,"sparks",null,{alpha:0.7,gapx:-this.hw/2,gapy:this.hh,frames:{speed:4,frames:[3,2,1,2,3]},accy:-help.random(0,4),accx:-1,tileset:"flame-white"});
				toys.generate.sparks.simple(this,"sparks",null,{alpha:0.7,gapx:this.hw/2,gapy:this.hh,frames:{speed:4,frames:[3,2,1,2,3]},accy:-help.random(0,4),accx:1,tileset:"flame-white"});
			}
		},whenClosed:function() {
			this.x++; // Place the door in the right position
		},questid:id,openwith:openwith,closing:animated,doorheight:50,fullhit:true,tilex:x,tiley:y,tileset:tileset,audiobefore:"explosion",audioafter:"megaexplosion",frames:{speed:1,frames:[0]}});
		if (openwith) {
			door.doPlayerAction=function(by) { // When used
				if (maingame.hud.getValue(this.openwith,"value")>0) {
					if (this.questid!=null) tilemaps.queststatus[this.questid]=true; // Mark this door as opened
					maingame.hud.addValue(this.openwith,"value",-1);
					this.doOpen();
					gbox.hitAudio("default-menu-confirm");
					maingame.addQuestClear(openwith+" USED");
				} else {
					gbox.hitAudio("beepbad");
					maingame.addQuestClear("NEEDS "+openwith);
				}
			}
		}
	}

	// Starts a dialogue
	maingame.startDialogue=function(id,pause) {
		if ((maingame.difficulty==0)||(!dialogues[id].istutorial)) { // dialogues marked as tutorial are shown only on easy. This flag is in the dialogue itself.
			gbox.addObject({
				group:"foreground",
				id:"dialogue",
				dialogueToRead:id,
				pause:1+(pause==null?0:1), // Pauses a dialog for a while. Is important to wait a frame very time to cancel the last "b" key press (for interacting, for example)
				initialize:function() {
					gbox.getObject("player","player").doPause(true); // First pause the player
				},
				blit:function() {
					if (this.pause)
						this.pause--;
					else if (toys.dialogue.render(this,"dialogue",dialogues[this.dialogueToRead])) { // If the dialogue is ended
						if (dialogues[this.dialogueToRead].endgame) // If the dialogue is marked by "endgame"...
							maingame.gameIsCompleted(); // The game is completed
						else
							gbox.getObject("player","player").doPause(false); // Unpause the player
							gbox.trashObject(this); // Trash the dialogue itself.
						}
					}
			});
		}
	}

	// Add a still object. Are sprites that supports the z-index (houses, trees.) You can walk around these objects
	maingame.addBlock=function(x,y,tileset,frame) {
		gbox.addObject({
			group:"walls",
			tileset:tileset,
			zindex:0, // Needed for zindexed objects
			x:x,
			y:y,
			frame:frame,

			initialize:function() {
				toys.topview.initialize(this); // Any particular initialization. Just the auto z-index
			},

			blit:function() {
				if (gbox.objectIsVisible(this)) {
					// Then the object. Notes that the y is y-z to have the "over the floor" effect.
					gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y+this.z,camera:this.camera,fliph:this.fliph,flipv:this.flipv});
				}
			}
		});
	}

	// Add a npc (Not Playing Charachter)
	maingame.addNpc=function(x,y,still,dialogue,questid,talking,silence) {
		// An easy way to create an NPC.
		gbox.addObject(new Npc(x,y,still,dialogue,questid,talking,silence));
	}

	// Add an enemy
	maingame.addEnemy=function(id,type,x,y,cloud) {
		var enemy=gbox.addObject(new Enemy(id,type,x,y,cloud));
		if (cloud) maingame.addSmoke(enemy,"flame-blue");
		return enemy;
	}
	gbox.go();
}

// BOOTSTRAP
gbox.onLoad(function () {
	help.akihabaraInit({title:"The Legend Of Sadness",splash:{footnotes:["Musics by: Greenleo, Graulund, Robert Jaret.","Full credits on ending title."]}});

	// We are not going to use faces for dialogues
	noface={ noone:{ x:10, y:170,box:{x:0,y:160,w:gbox.getScreenW(),h:60,alpha:0.5} } };

	audioserver="resources/audio/"

	gbox.addBundle({file:"resources/bundle.js"}); // Audio, sprites, fonts etc. are loaded here now. Cleaner code! Btw you can still load resources from the code, like in Capman.

	gbox.loadAll(go);
}, false);
