var Player = function(){
	return({
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
}
