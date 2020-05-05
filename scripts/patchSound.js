/**
 * Configure module features.
 */
Hooks.once("init", function() {
  game.settings.register("tweakplaylist", "hidetracks", {
      name: "Hide Tracks",
      hint: "Hide playlist and tracks from players",
      scope: "world",
      type: Boolean,
      default: false,
      config: true,
      onChange: s => {}
  });
  game.settings.register("tweakplaylist", "allowrandom", {
      name: "Allow Random",
      hint: "Allow random loop delays and random volume adjustments",
      scope: "world",
      type: Boolean,
      default: false,
      config: true,
      onChange: s => {}
  });
});

class trdisPlaylist {

  /**
   * Display playlists only to the GM.
   */
  static hidePlaylist() {
    let newClass = PlaylistDirectory;
    newClass = trPatchLib.patchMethod(newClass, "getData", 4,
      `let visible = game.playlists.entities.filter(p => isGM || p.sounds.some(s => s.playing));`,
      `let visible = game.playlists.entities.filter(p => isGM);`);
    if (!newClass) return;
    PlaylistDirectory.prototype.getData = newClass.prototype.getData;
  }

  /**
   * Implement random loop delays and volume changes.
   */
  static randomizeSound() {
    let newClass = Playlist;
    newClass = trPatchLib.patchMethod(newClass, "_onEnd", 5,
      `if (sound.repeat) return;`,
      `if (sound.repeat) {
        if ( sound.flags.mindelay === undefined || !sound.flags.maxdelay ) return;
        else {
          let p = this;
          p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: false});
          if (sound.flags.mindelay > sound.flags.maxdelay) {
            let newflags = sound.flags;
            newflags.mindelay = sound.flags.maxdelay;
            p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, flags: newflags});
          }
          let tMin = sound.flags.mindelay;
          let tMax = sound.flags.maxdelay;
          let tDelay = Math.floor( 1000 * ( tMin + ( Math.random() * (tMax-tMin) ) ) );
          setTimeout( function() { p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: true}); }, tDelay);
          return;
        }
      }`);
    if (!newClass) return;
    Playlist.prototype._onEnd = newClass.prototype._onEnd;
    newClass = trPatchLib.patchMethod(newClass, "playSound", 10,
    `let vol = sound.volume * game.settings.get("core", "globalPlaylistVolume");`,
    `let minVol = ( sound.flags.minvolume === undefined ) ? 1.0 : parseFloat(sound.flags.minvolume);
    let volAdj = ( minVol === 1.0 ) ? 1.0 : Math.pow( minVol + ( Math.random() * ( 1 - minVol )), 2);
    let vol = sound.volume * game.settings.get("core", "globalPlaylistVolume") * volAdj;`);
    if (!newClass) return;
    Playlist.prototype.playSound = newClass.prototype.playSound;
  }

}

Hooks.once("ready", function() {
  if (game.settings.get("tweakplaylist", "hidetracks")) trdisPlaylist.hidePlaylist();
  if (game.settings.get("tweakplaylist", "allowrandom")) {
    trdisPlaylist.randomizeSound();
    trPatchLib.replaceStaticGetter(PlaylistSoundConfig, "defaultOptions", function () {
      let def_options = trPatchLib.callOriginalGetter(PlaylistSoundConfig, "defaultOptions");
      def_options.template = "modules/tweakplaylist/templates/edit-track.html";
      return def_options;
    });
  }
});
