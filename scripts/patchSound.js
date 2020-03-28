/**
 * Configure module features.
 */ 
CONFIG._tweakplaylist_module_hidetracks = true;   // Hide playlists for everyone but the GM
CONFIG._tweakplaylist_module_allowrandom = true;  // Enable random loop delays and random volume adjustments

/**
 * Display playlists only to the GM.
 */
if (CONFIG._tweakplaylist_module_hidetracks) {
  PlaylistDirectory.prototype.getData = function() {
    // Reduce the set of playlists to only ones that are visible
    let isGM = game.user.isGM;
    let visible = game.playlists.entities.filter(p => isGM);   // ! Changed line
    let playlists = visible.map(p => duplicate(p.data));
  
    // Configure display for each playlist
    for (let p of playlists) {
      p.modeIcon = this._getModeIcon(p.mode);
      p.modeTooltip = this._getModeTooltip(p.mode);
      p.disabled = p.mode === CONST.PLAYLIST_MODES.DISABLED;
      p.controlCSS = isGM && !p.disabled ? "" : "disabled";
      p.expanded = this._expanded.has(p._id);
  
      // Reduce the visible sounds to those currently playing
      p.sounds = p.sounds.filter(s => s.playing || isGM).map(s => {
        s.lvolume = AudioHelper.volumeToInput(s.volume);
        s.controlCSS = isGM ? "" : "disabled";
        return s;
      });
    }
  
    // Return Playlist data for rendering
    return {
      user: game.user,
      isGM: isGM,
      entities: playlists,
      playlistModifier: AudioHelper.volumeToInput(game.settings.get("core", "globalPlaylistVolume")),
      ambientModifier: AudioHelper.volumeToInput(game.settings.get("core", "globalAmbientVolume")),
      interfaceModifier: AudioHelper.volumeToInput(game.settings.get("core", "globalInterfaceVolume")),
    }
  }
}

if (CONFIG._tweakplaylist_module_allowrandom) {
  
  /**
   * Implement random loop delays.
   */
  Playlist.prototype._onEnd = async function(soundId) {
    if (!game.user.isGM) return;

    // Retrieve the sound object whose reference may have changed
    const sound = this.getEmbeddedEntity("PlaylistSound", soundId);
    if (sound.repeat) {                                        // ! Changed line
      if ( sound.flags.mindelay === undefined || sound.flags.maxdelay === undefined) return;
      else {
        let p = this;
        p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: false});
        let tMin = sound.flags.mindelay;
        let tMax = sound.flags.maxdelay;
        let tDelay = Math.floor( 1000 * ( tMin + ( Math.random() * (tMax-tMin) ) ) );
        setTimeout( function() { p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: true}); }, tDelay);
        return;}
    }

    // Conclude playback for the current sound
    const isPlaying = this.data.playing;
    await this.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: false});

    // Sequential or shuffled playback -- begin playing the next sound
    if (isPlaying && [CONST.PLAYLIST_MODES.SEQUENTIAL, CONST.PLAYLIST_MODES.SHUFFLE].includes(this.mode)) {
      let next = this._getNextSound(sound._id);
      if (next) await this.updateEmbeddedEntity("PlaylistSound", {_id: next._id, playing: true});
      else await this.update({playing: false});
    }

    // Simultaneous playback - check if all have finished
    else if (isPlaying && this.mode === CONST.PLAYLIST_MODES.SIMULTANEOUS) {
      let isComplete = !this.sounds.some(s => s.playing);
      if (isComplete) {
        await this.update({playing: false});
      }
    }
  }

  /**
   * Implement random volume adjustments.
   */
  Playlist.prototype.playSound = function(sound) {
    // Get the audio data
    const audio = this.audio[sound._id];
    if (!sound.playing && !audio.id) return;

    // Start playing
    if (sound.playing) {
      if (audio.howl.state() !== "loaded") audio.howl.load();
      audio.id = audio.howl.play(audio.id);
      let minVol = ( sound.flags.minvolume === undefined ) ? 1.0 : parseFloat(sound.flags.minvolume);    // ! New line
      let volAdj = ( minVol === 1.0 ) ? 1.0 : Math.pow( minVol + ( Math.random() * ( 1 - minVol )), 2);  // ! New line
      let vol = sound.volume * game.settings.get("core", "globalPlaylistVolume") * volAdj;               // ! Changed line
      audio.howl.volume(vol, audio.id);
      audio.howl.loop(sound.repeat, audio.id);
    }

    // End playback
    else audio.howl.stop(audio.id);
  }

  /**
   * Use custom template for PlaylistSoundConfig to configure 
   * random delays and random volume adjustments.
   */
  replaceDefaultOptions = function(class_) {
    defaultOptionsProperty = Object.getOwnPropertyDescriptor(class_, "defaultOptions");
    if (defaultOptionsProperty == undefined) {
      defaultOptionsProperty = Object.getOwnPropertyDescriptor(FormApplication, "defaultOptions");
    }
    Object.defineProperty(class_, '_sound_config_defaultOptions', defaultOptionsProperty);
    Object.defineProperty(class_, 'defaultOptions', {
      get: function () {
        def_options = class_._sound_config_defaultOptions;
        def_options.template = def_options.template.replace("templates/playlist/", "modules/tweakplaylist/templates/")
        return def_options
      }
    });
  };

  replaceDefaultOptions(PlaylistSoundConfig);
}
