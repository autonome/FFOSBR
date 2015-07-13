// TODO - Storage needs to be moved into its own file. This
// is currently just a work-around which can be transferred
// after the dependency refactor.

/**
 * @description Basic "storage" class to help simplify code in the
 *  Media module, and help offload some functionality in detecting
 *  write-collisions. The main purpose of this class is to indicate
 *  the availability of a DeviceStorage object, and to keep track of
 *  all files in the DeviceStorage without having to query as often.
 * @param {string} type: The type of storage being held.
 *   Note: See Media > storageTypes for a list of valid types.
 * @param {DeviceStorage} store: The DeviceStorage used by this
 *   storage instance.
 */
function Storage(type, store) {

  this.type = null;
  this.store = null;
  this.files = {};
  this.updating = false;

  // Constructor

  // Note: The code below is commented out because of circular
  // dependencies. This is a big problem, and needs to be dealt
  // with. The build system may need to be restructured.

  // if (typeof ffosbr.media.storageTypes[type] !== 'string') {
  //   throw new Error('Invalid media type ' + type);
  // }

  if (typeof type !== 'string') {
    throw new Error('Invalid media type ' + type);
  }
  if (!store || !(store instanceof DeviceStorage)) {
    throw new Error('Invalid DeviceStorage object');
  }

  this.type = type;
  this.store = store;
  this.populate();
}

/**
 * @description Reports whether or not a file exists in a
 *   given storage.
 * @param {string} fname: Name of file to check.
 * @param {callback} oncomplete: It is possible that the files
 *   were being repopulated when this function was called. For
 *   that reason, this method has to be asynchronous and wait
 *   for the update to finish before returning a value.
 */
Storage.prototype.fileExists = function(fname, oncomplete) {

  var that = this;
  if (this.updating === true) {
    setTimeout(function() {
      that.fileExists(fname, oncomplete);
    }, 5);
    return;
  }

  if (this.files[this.sanatizeFilename(fname)] === true) {
    oncomplete(true);
  } else {
    oncomplete(false);
  }
};

/**
 * @description Enumerates all files on storage and adds thems
 *   to the "files" object. This is used for tracking what files
 *   exist in the storage at all times.
 */
Storage.prototype.populate = function() {

  var that = this;
  var listFiles = {}; // cursor

  this.updating = true; // files are in flux
  this.files = {}; // erase record of current files

  try {
    listFiles = this.store.enumerate();
  } catch (e) {
    throw e;
  }

  listFiles.onsuccess = function() {
    var file = this.result;
    if (file) {
      var name = that.sanatizeFilename(file.name);
      that.files[name] = true;
    } else {
      that.updating = false;
    }
  };

  listFiles.onerror = function() {
    throw new Error('Failed to list files on storage device ' + this.type);
  };
};

/**
 * @description Santizes file names such that they are valid
 *   object keys.
 * @fname File name to sanatize.
 * @returns {string}
 */
Storage.prototype.sanatizeFilename = function(fname) {
  // TODO - This is not legit.
  fname = fname.replace(/-/g, 'x');
  fname = fname.replace(/\./g, 'y');
  return fname;
};





/**
 * Manages internal and external storages, or handles to storage
 * devices, and their various data sets, including apps, music,
 * pictures, sdcard, and videos.
 */
function Media() {

  // Public data members

  // Valid storage types
  this.storageTypes = [
    // 'apps',
    // 'music',
    'pictures',
    'sdcard',
    // 'videos'
  ];

  // Contains a storage {Storage} for each internal storage type.
  this.internal = {};

  // Contains a storage {Storage} for each external storage type.
  this.external = {};

  // Constructor
  for (var i = 0; i < this.storageTypes.length; ++i) {

    var type = this.storageTypes[i];

    // Fetch all {DeviceStorage} of the specified type
    var stores = navigator.getDeviceStorages(type);

    // Extract internal DeviceStorage and create Storage object
    this.internal[type] = new Storage(type, this.getInternalStorage(stores));

    // Extract external DeviceStorage and create Storage object
    this.external[type] = new Storage(type, this.getExternalStorage(stores));
  }
}

/**
 * @access public
 * @description Takes an array of DeviceStorage objects and returns
 *   whichever represents the internal storage.
 * @param {array of DeviceStorage} stores
 * @returns {DeviceStorage}
 */
Media.prototype.getInternalStorage = function(stores) {

  // TODO - if there are multiple internal
  // storages, do we just use the largest?

  for (var i = 0; i < stores.length; ++i) {
    if (stores[i].isRemovable === false) {
      return stores[i];
    }
  }

  return null;
};

/**
 * @access private
 * @description Takes an array of DeviceStorage objects and returns
 *   whichever represents the external storage.
 * @param {array of DeviceStorage} stores
 * @returns {DeviceStorage}
 */
Media.prototype.getExternalStorage = function(stores) {

  // TODO - if there are multiple external
  // storages, do we just use the largest?

  for (var i = 0; i < stores.length; ++i) {
    if (stores[i].isRemovable === true) {
      return stores[i];
    }
  }

  return null;
};

/**
 * @access public
 * @description Takes a string describing which type of storage is desired.
 *   Valid options are listed in the "storageTypes" array.
 * @param {String} type
 * @returns {Object} Containing the appropriate internal and external storages.
 */
Media.prototype.getStorageByName = function(type) {

  var stores = {
    internal: null,
    external: null
  };

  if (this.storageTypes.indexOf(type) < 0) {
    throw new Error('Invalid media type');
  }

  stores.internal = this.internal[type];
  stores.external = this.external[type];
  return stores;
};

/**
 * @access public
 * @description Fetches files from both internal and external storages
 *   via DOMRequest. The type of files fetched (e.g. pictures, music) is
 *   specified by the "type" parameter. Each file fetched will be passed
 *   to the provided "forEach" handler as a File object. If the "type"
 *   parameter is "sdcard1" and a "directory" parameter is provided, only
 *   files found in the specified directory will be returned.
 *   (Note: File extends Blob)
 * @param {String} type
 * @param {String} directory (optional)
 * @param {callback} forEach
 */
Media.prototype.get = function(type, directory, forEach) {

  var storages = null;
  var internal = null;
  var external = null;
  var internalFiles = {};
  var externalFiles = {};

  // TODO - write utility/settings function to confirm
  // a valid media type.
  if (typeof(type) !== 'string') {
    throw new Error('Missing or invalid media type');
  }

  if (typeof(directory) !== 'string') {
    if (ffosbr.utils.isFunction(directory)) {
      // Parameter "directory" was not provided, and the
      // second parameter is really the "forEach" function
      forEach = directory;
    } else if (ffosbr.utils.isFunction(forEach)) {
      throw new Error('Missing or invalid directory');
    } else {
      throw new Error('Missing or invalid callback');
    }
    directory = null;
  }

  if (!ffosbr.utils.isFunction(forEach)) {
    throw new Error('Missing or invalid callback');
  }

  storages = this.getStorageByName(type === 'sdcard1' ? 'sdcard' : type);

  internal = storages.internal;
  external = storages.external;

  if (type === 'sdcard1') {
    externalFiles = external.store.enumerate(directory);
  } else {
    // Fall back to empty objects to avoid errors providing
    // "onsuccess" callbacks to null variables.
    internalFiles = internal.store.enumerate();
    externalFiles = external.store.enumerate();
  }

  var onsuccess = function() {
    var file = this.result;
    if (ffosbr.utils.isFunction(forEach)) {
      forEach(file);
    }
  };

  var onerror = function() {
    if (ffosbr.utils.isFunction(forEach)) {
      forEach(undefined, new Error('Attempt to read from an invalid storage. Abort.'));
    }
  };

  internalFiles.onsuccess = onsuccess;
  externalFiles.onsuccess = onsuccess;
  internalFiles.onerror = onerror;
  externalFiles.onerror = onerror;
};


/**
 * @access public
 * @description Writes files to a specified destination. If the file type is
 *   'apps', 'music', 'pictures', 'sdcard', or 'videos' then the file will be
 *   handed off to the OS and any file paths in the 'dest' parameter will be
 *   ignored. If the file type is 'sdcard1' the file will be written to the
 *   external storage device with the exact 'dest' provided. If an oncomplete
 *   callback if provided, it will be called after the file has been written.
 * @param {String} type
 * @param {File} file
 * @param {String} dest
 * @param {requestCallback} oncomplete (option)
 */
Media.prototype.put = function(type, file, dest, oncomplete) {

  var filename = null; // dest without file paths
  var storages = null; // array of DeviceStorage
  var targetStorage = null; // DeviceStorage to write to
  var sname = null; // valid OS media type
  var write = null; // cursor or iterator

  if (typeof(type) !== 'string') {
    throw new Error('Missing or invalid media type');
  }

  if (!(file instanceof File)) {
    throw new Error('Missing or invalid file');
  }

  if (typeof(dest) !== 'string') {
    throw new Error('Missing or invalid write destination');
  }

  if (oncomplete && !ffosbr.utils.isFunction(oncomplete)) {
    throw new Error('Callback is not a function');
  }

  // strip out the file path
  filename = dest.substr(dest.lastIndexOf('/') + 1, dest.length);

  // If the type is 'sdcard1', use name 'sdcard'
  sname = (type === 'sdcard1' ? 'sdcard' : type);
  storages = this.getStorageByName(sname);

  if (type === 'sdcard1') {
    if (storages.external !== null) {
      targetStorage = storages.external;
    } else {
      throw new Error('Attempt to write to an invalid storage. Abort.');
    }
  } else {
    targetStorage = (storages.internal === null ? storages.external : storages.internal);
  }

  try {
    if (type === 'sdcard1') {
      write = targetStorage.store.addNamed(file, dest);
    } else {
      write = targetStorage.store.addNamed(file, filename);
    }
  } catch (e) {
    throw new Error('Attempt to write to an invalid storage. Abort.');
  }

  write.onsuccess = function(fileWritten) {
    // Only call the oncomplete callback if it was provided
    if (ffosbr.utils.isFunction(oncomplete)) {
      oncomplete();
    }
  };

  write.onerror = function() {

    var error = this.error;
    // Only call the oncomplete callback if it was provided
    if (ffosbr.utils.isFunction(oncomplete)) {

      // The majority of errors thrown by Firefox OS do not provide messages.
      if (error.message.length > 0) {
        oncomplete(error);
      } else {
        oncomplete(new Error('Attempt to write to an invalid storage. Abort.'));
      }
    }
  };
};

/**
 * @access public
 * @description Removes a file from the external sdcard. If an oncomplete
 *   callback is provided, it will be called after the file is removed.
 * @param {String} filename - Specifies the full path to the file to be
 *   removed from the external sdcard (sdcard1).
 * @param {requestCallback} oncomplete (optional)
 */
Media.prototype.remove = function(filename, oncomplete) {

  var externalSD = this.getStorageByName('sdcard').external;
  var remove = null; // cursor or iterator

  if (typeof(filename) !== 'string') {
    throw new Error('Missing or invalid filename');
  }

  if (oncomplete && !ffosbr.utils.isFunction(oncomplete)) {
    throw new Error('Callback is not a function');
  }

  try {
    remove = externalSD.store.delete(filename);
  } catch (e) {
    throw new Error('Attempt to delete from invalid storage. Abort.');
  }

  remove.onsuccess = function() {
    // Only call the oncomplete callback if it was provided
    if (ffosbr.utils.isFunction(oncomplete)) {
      oncomplete();
    }
  };

  remove.onerror = function() {

    var error = this.error;
    // Only call the oncomplete callback if it was provided
    if (ffosbr.utils.isFunction(oncomplete)) {

      // The majority of errors thrown by Firefox OS do not provide messages.
      if (error.message.length > 0) {
        oncomplete(error);
      } else {
        oncomplete(new Error('Attempt to delete from invalid storage. Abort.'));
      }
    }
  };
};

/**
 * @access public
 * @description Calculates free space on the provided DeviceStorage instance
 *   and then invokes a callback with the result (in bytes).
     (Note: a second "error" parameter will be passed to the callback if the
     request fails)
 * @param {DeviceStorage} storage
 * @param {requestCallback} oncomplete
 */
Media.prototype.getFreeBytes = function(storage, oncomplete) {

  var getFreeBytes = null;

  if ((storage instanceof DeviceStorage) === false) {
    throw new Error('Missing or invalid storage device');
  }

  if (!ffosbr.utils.isFunction(oncomplete)) {
    throw new Error('Missing or invalide callback');
  }

  getFreeBytes = storage.freeSpace();

  getFreeBytes.onsuccess = function() {
    var size = this.result;
    oncomplete(size);
  };

  getFreeBytes.onerror = function() {
    var error = this.error;
    oncomplete(null, new Error('Failed to get available space: ' + error.message));
  };
};

// Extend Ffosbr library
module.exports = new Media();
