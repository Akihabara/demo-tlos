var Enemy = function(id,type,x,y,cloud){
	var td=gbox.getTiles(tilemaps.map.tileset);

	var ob;
	switch (type) {
		case "eyeswitch": { // The classic eye-shaped switch
			ob={
				questid:id,
				group:"foes",
				tileset:"npc",
				zindex:0, // Needed for zindexed objects
				x:x*td.tilew,
				y:y*td.tileh,
				switchedon:false,
				frame:0,
				changeSwitch:function(sw) {
					this.switchedon=(sw?true:false); // The switch is on
					this.frame=(sw?1:0); // Change image
					if (this.questid!=null) tilemaps.queststatus[this.questid]=(sw?true:false); // Mark the quest as done
				},

				initialize:function() {
					toys.topview.initialize(this); // Any particular initialization. Just the auto z-index
				},

				hitByBullet:function(by) {
					if (by._canhitswitch&&!this.switchedon) { // if is hit by bullet
						gbox.hitAudio("default-menu-option");
						this.changeSwitch(true);
						maingame.addQuestClear(); // Say "quest clear"
					}
				},

				blit:function() {
					if (gbox.objectIsVisible(this)) {
						// Then the object. Notes that the y is y-z to have the "over the floor" effect.
						gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y+this.z,camera:this.camera,fliph:this.fliph,flipv:this.flipv});
					}
				}
			};
			break;
		}
		case "octo": {
			ob={
				id:id,
				group:"foes",
				tileset:"foe1",
				zindex:0, // Needed for zindexed objects
				invultimer:0, // Custom attribute. A timer that keep invulnerable.
				stilltimer:0, // Custom attribute. A timer that keep the enemy still.
				x:x*td.tilew,
				y:y*td.tileh,

				initialize:function() {
					toys.topview.initialize(this,{
						health:3, // Custom attribute. Indicates the strength.
						shadow:{tileset:"shadows",tile:0},
						frames:{
							standup:{ speed:1, frames:[1] },
							standdown:{ speed:1, frames:[3] },
							standleft:{ speed:1, frames:[4] },
							standright:{ speed:1, frames:[4] },
							movingup:{speed:3,frames:[0,1] },
							movingdown:{speed:3,frames:[2,3] },
							movingleft:{speed:3,frames:[4,5] },
							movingright:{speed:3,frames:[4,5] }
						}
					});
				},
				kill:function(by){
					gbox.hitAudio("hurt");
					toys.generate.sparks.simple(this,"sparks",null,{animspeed:2,accy:-3,tileset:"flame-blue"});
					toys.generate.sparks.simple(this,"sparks",null,{animspeed:1,accx:-3,tileset:"flame-blue"});
					toys.generate.sparks.simple(this,"sparks",null,{animspeed:1,accx:3,tileset:"flame-blue"});
					if (help.random(0,2)==0) maingame.addBonus(this.x,this.y,"coin"); // reward with a coin, sometime
					gbox.trashObject(this); // Vanish!
				},

				attack:function() {
				if (gbox.objectIsVisible(this)) gbox.hitAudio("hit"); // Only visible enemies plays audio: audio heard without seeying anything is confusing.
					this.stilltimer=10; // Stay still for a while
					this.frame=(this.facing==toys.FACE_UP?0:(this.facing==toys.FACE_DOWN?3:4));
					toys.generate.sparks.simple(this,"sparks",null,{animspeed:2,accy:-2,tileset:"flame-white"});
					toys.topview.fireBullet("foesbullets",null,{
						fullhit:true,
						collidegroup:"player",
						map:tilemaps.map, // Map is specified, since collides with walls
						mapindex:"map",
						defaulttile:tilemaps._defaultblock,
						undestructable:false, // Custom attribute. Is destroyed by the hitted object.
						power:1, // Custom attribute. Is the damage value of this weapon.
						from:this,
						sidex:this.facing,
						sidey:this.facing,
						tileset:"bullet-black",
						frames:{speed:1,frames:[0]},
						acc:5,
						fliph:(this.facing==toys.FACE_RIGHT),
						flipv:(this.facing==toys.FACE_DOWN),
						angle:toys.FACES_ANGLE[this.facing],
						spritewalls:"walls",
						gapy:7 // Avoid wall collision on start
					});
				},

				hitByBullet:function(by) {
					if (!this.invultimer) { // If is not invulnerable
						this.health-=by.power; // Decrease power
						if (this.health<=0) // If dead..
							 this.kill(); // Kill...
						else { // Else is just hit
							this.accz=-5; // A little jump...
							this.invultimer=10; // Stay invulnerable for a while...
							this.stilltimer=10; // Stay still for a while...
						 }
						return by.undestructable; // Destroy or not a bullet (decided by the bullet itself)
					}
				},

				first:function() {
					if (this.stilltimer) this.stilltimer--;
					if (this.invultimer) this.invultimer--;

					if (objectIsAlive(this)) {
						// Counter
						this.counter=(this.counter+1)%60;
						if (!this.killed) {
							if (!this.stilltimer) toys.topview.wander(this,tilemaps.map,"map",100,{speed:1,minstep:20,steprange:150}); // tile collisions
							if ((!this.stilltimer)&&toys.timer.randomly(this,"fire",{base:50,range:50})) this.attack(); // Fires randomly
							toys.topview.handleAccellerations(this);
							toys.topview.handleGravity(this); // z-gravity
							if (!this.stilltimer) toys.topview.applyForces(this); // Apply forces
							toys.topview.applyGravity(this); // z-gravity
							toys.topview.tileCollision(this,tilemaps.map,"map",100); // tile collisions
							toys.topview.spritewallCollision(this,{group:"walls"}); // walls collisions
							toys.topview.floorCollision(this); // Collision with the floor (for z-gravity)
							toys.topview.adjustZindex(this); // Set the right zindex
							if (!this.stilltimer) toys.topview.setFrame(this); // set the right animation frame (if not attacking - which has still frame)
							var pl=gbox.getObject("player","player");
							if (!pl.initialize&&pl.collisionEnabled()&&(toys.topview.collides(this,pl))) pl.hitByBullet({power:1}); // If colliding with the player, hit with power 1
						}
					}
				},
				blit:function() {
					if ((!this.killed)&&gbox.objectIsVisible(this)&&((this.invultimer%2)==0)) {
						// Shadowed object. First draws the shadow...
						gbox.blitTile(gbox.getBufferContext(),{tileset:this.shadow.tileset,tile:this.shadow.tile,dx:this.x,dy:this.y+this.h-gbox.getTiles(this.shadow.tileset).tileh+4,camera:this.camera});

						// Then the object. Notes that the y is y-z to have the "over the floor" effect.
						gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y+this.z,camera:this.camera,fliph:this.fliph,flipv:this.flipv});
					 }
				}
			};
			break;
		}
	}
	return ob;
}
