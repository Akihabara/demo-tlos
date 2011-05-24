var Bonus = function(x,y,type,id,expire,frames){
	return({
		group:"bonus",
		questid:id,
		tileset:"bonus",
		zindex:0, // Needed for zindexed objects
		x:x,
		y:y,
		accz:-10, // Bounces
		bonustype:type,
		expiretime:(expire==null?100:(expire==0?null:expire)),
		unpicktime:10,
		frames:frames, // You can specify attributes outside from the initialization. Are kept instead the default one.

		initialize:function() {
			toys.topview.initialize(this,{
				shadow:{tileset:"shadows",tile:0}
			});
		},

		first:function() {
			if ((this.expiretime!=null)&&this.expiretime) this.expiretime--;
			if (this.unpicktime) this.unpicktime--;
			if (this.expiretime===0) {
				gbox.trashObject(this);
			} else if (objectIsAlive(this)) {
				// Counter
				this.counter=(this.counter+1)%60;
				toys.topview.handleAccellerations(this);
				toys.topview.handleGravity(this); // z-gravity
				toys.topview.applyForces(this); // Apply forces
				toys.topview.applyGravity(this); // z-gravity
				toys.topview.floorCollision(this,{bounce:2,audiobounce:"beep"}); // Collision with the floor (for z-gravity)
				toys.topview.adjustZindex(this); // Set the right zindex
				toys.topview.setFrame(this); // set the right animation frame (if not attacking - which has still frame)
				if (!this.unpicktime) {
					var pl=gbox.getObject("player","player");
					if (pl.collisionEnabled()&&(toys.topview.collides(this,pl))) {
						gbox.hitAudio("coin");

						switch (this.bonustype) {
							case "coin": {
								maingame.hud.addValue("cash","value",1);
								maingame.addQuestClear("1 GOLD");
								break;
							}
							case "arrow": {
								maingame.addQuestClear("ARROWS");
								if (!tilemaps.queststatus["arrowstutorial"]) { // If the first time...
									maingame.startDialogue("arrowstutorial"); // Explain how to use arrows
									tilemaps.queststatus["arrowstutorial"]=true;
								}

								tilemaps.queststatus["floor2arrows"]=true; // Arrows picked
								maingame.hud.setValue("weapon","frames",[0,1]); // Add arrows to the inventory (0: sword, 1: arrows)
								break;
							}
							case "BOSSKEY":
							case "SMALLKEY": {
								maingame.addQuestClear(this.bonustype);
								if (this.questid) tilemaps.queststatus[this.questid]=true; // Key picked
								maingame.hud.addValue(this.bonustype,"value",1); // Add key to inventory
								break;
							}
						}
						gbox.trashObject(this);
					}
				}
			}
		},
		blit:function() {
			if (gbox.objectIsVisible(this)) {
				// Shadowed object. First draws the shadow...
				gbox.blitTile(gbox.getBufferContext(),{tileset:this.shadow.tileset,tile:this.shadow.tile,dx:this.x,dy:this.y+this.h-gbox.getTiles(this.shadow.tileset).tileh+4,camera:this.camera});
				if ((this.expiretime>30)||((this.expiretime<30)&&(this.expiretime%2==0)))
					// Then the object. Notes that the y is y-z to have the "over the floor" effect.
					gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y+this.z,camera:this.camera,fliph:this.fliph,flipv:this.flipv});
			}
		}
	});
}
