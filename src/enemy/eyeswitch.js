var Eyeswitch = function(){
	return({
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
	});
}
