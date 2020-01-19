/**
 * Utility function used by patch functions to alter specific lines in a class
 * @param {Class} klass           Class to be patched
 * @param {Function} func         Function in the class to be patched
 * @param {Number} line_number    Line within the function to be patched
 * @param {String} line           Existing text of line to be patched
 * @param {String} new_line       Replacement text for line to be patched
 * @returns {Class}              Revised class
 */
function patchClass(klass, func, line_number, line, new_line) {
  let funcStr = func.toString()
  let lines = funcStr.split("\n")
  if (lines[line_number].trim() == line.trim()) {
    lines[line_number] = lines[line_number].replace(line, new_line);
    classStr = klass.toString()
    fixedClass = classStr.replace(funcStr, lines.join("\n"))
    return Function('"use strict";return (' + fixedClass + ')')();
  }
  else {
    console.log("Function has wrong content at line ", line_number, " : ", lines[line_number].trim(), " != ", line.trim(), "\n", funcStr)
  }
}

/**
 * Patch PlaylistDirectory class to display playlists only to the GM
 */
function patchPlaylistDirectoryClass() {
    newClass = patchClass(PlaylistDirectory, PlaylistDirectory.prototype.getData, 4,
      `let visible = game.playlists.entities.filter(p => isGM || p.sounds.some(s => s.playing));`,
      `let visible = game.playlists.entities.filter(p => isGM);`);
    if (!newClass) return;
    PlaylistDirectory = newClass
}

if (patchedPlaylistDirectoryClass == undefined) {
  patchPlaylistDirectoryClass();
  var patchedPlaylistDirectoryClass = true;
}

/**
 * Patch Playlist class to implement random loop delays and random volume adjustments
 */
function patchPlaylistClass() {
    newClass = patchClass(Playlist, Playlist.prototype._onEnd, 5,
      `if (sound.repeat) return;`,
      `if (sound.repeat) {
      if ( sound.flags.mindelay === undefined || sound.flags.maxdelay === undefined) return;
      else {
        let p = this;
        p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: false});
        let tMin = sound.flags.mindelay;
        let tMax = sound.flags.maxdelay;
        let tDelay = Math.floor( 1000 * ( tMin + ( Math.random() * (tMax-tMin) ) ) );
        setTimeout( function() { p.updateEmbeddedEntity("PlaylistSound", {_id: sound._id, playing: true}); }, tDelay);
        return;}}`);
    if (!newClass) return;
    newClass = patchClass(newClass, Playlist.prototype.playSound, 10,
      `let vol = sound.volume * game.settings.get("core", "globalPlaylistVolume");`,
      `let minVol = ( sound.flags.minvolume === undefined ) ? 1.0 : parseFloat(sound.flags.minvolume);
      let volAdj = ( minVol === 1.0 ) ? 1.0 : Math.pow( minVol + ( Math.random() * ( 1 - minVol )), 2);
      let vol = sound.volume * game.settings.get("core", "globalPlaylistVolume") * volAdj;`);
    if (!newClass) return;
    Playlist = newClass
}

if (patchedPlaylistClass == undefined) {
  patchPlaylistClass();
  var patchedPlaylistClass = true;
}

/**
 * Use custom template for PlaylistSoundConfig to configure random delays and random volume adjustments 
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
