(function() {

  var Ffosbr = function() {

    // To be included after dependency refactor
    // require('./storage');

    /* Import modules */
    this.utils = require('./utils');
    this.media = require('./media');
    this.backup = require('./backup');
    this.restore = require('./restore');
    this.clean = require('./clean');
    this.settings = require('./settings');
  };

  window.ffosbr = new Ffosbr();
})();
