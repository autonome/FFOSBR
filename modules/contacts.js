/**
 * @access public
 * @description TODO
 */
var Contacts = function() {


  this.contacts = [];

};

/**
 * @access public
 * @description TODO
 */
Contacts.prototype.backup = function() {
  this.getContactsFromOS();
  this.getContactsFromSIM();
};

/**
 * @access public
 * @description TODO
 */
Contacts.prototype.restore = function() {
  var that = this;

  var reader = new FileReader();
  reader.onloadend = function() {
    var contents = this.result;
    var data = JSON.parse(contents);
    for (var i = 0; i < data.length; ++i) {
      navigator.mozContacts.save(new mozContact(data[i]));
    }
  };

  var sdcard = navigator.getDeviceStorages('sdcard')[1];

  var request = sdcard.get('/sdcard1/backup/contacts/contacts.json');
  request.onsuccess = function() {
    reader.readAsText(this.result);
  };

  request.onerror = function() {
    console.log('error orccured in restore');
    console.log(err);
  };


};

/**
 * @access public
 * @description TODO
 */

Contacts.prototype.clean = function(oncomplete) {
  var that = this;

  var sdcard = navigator.getDeviceStorages('sdcard')[1];
  var remove = sdcard.delete('/sdcard1/backup/contacts/contacts.json');


  remove.onsuccess = function() {
    if (window.ffosbr.utils.isFunction(oncomplete)) {
      oncomplete('Clean success');
    }
  };

  remove.onerror = function() {
    console.log('Remove error');
    if (window.ffosbr.utils.isFunction(oncomplete)) {
      oncomplete(remove.error);
    }
  };



};

/**

 * @access public
 * @description TODO
 */
Contacts.prototype.getContactsFromOS = function() {
  var that = this;

  var allContactsCursor;

  allContactsCursor = navigator.mozContacts.getAll({
    sortBy: 'name',
    sortOrder: 'ascending'
  });

  allContactsCursor.onsuccess = function() {
    var contact = this.result;
    if (contact) {
      that.contacts.push(contact);


      allContactsCursor.continue();
    } else {
      that.putContactsOnSD(function() {
        //------Log what is written to the sdcard--------//
        var sdcard = navigator.getDeviceStorages('sdcard')[1];
        var cursor = sdcard.enumerate();
        cursor.onsuccess = function() {

          if (this.result) {
            var file = this.result;
            if (file.name === '/sdcard1/backup/contacts/contacts.json') {
              console.log('sdcard contents: ', file);
            }

            //----------------------------------------------//
          }
        };
      });

    }
  };

  allContactsCursor.onerror = function() {
    console.log('Error getting contacts');
    that.putContactsOnSD(function() {
      //------Log what is written to the sdcard--------//
      var sdcard = navigator.getDeviceStorages('sdcard')[1];
      var cursor = sdcard.enumerate();
      cursor.onsuccess = function() {

        if (this.result) {
          var file = this.result;
          if (file.name === '/sdcard1/backup/contacts/contacts.json') {
            console.log('sdcard contents: ', file);
          }

          //----------------------------------------------//
        }
      };
    });
  };

};

/**
 * @access public
 * @description TODO
 */
Contacts.prototype.getContactsFromSIM = function() {

  var that = this;

  // Array of { MozMobileConnectionArray }
  var cards = navigator.mozMobileConnections;
  var request = null;

  var onSuccessFunction = function() {
    var contact = this.result;
    if (contact) {
      that.contacts = that.contacts.concat(contact);
    }
    that.getContactsFromOS();

  };

  var onErrorFunction = function() {
    console.log('Error getting contacts');
    that.getContactsFromOS();

  };

  var presentCards = 0;
  for (var i = 0; i < cards.length; ++i) {
    if (cards[i].iccId) {
      presentCards += 1;
      var id = navigator.mozIccManager.iccIds[i];
      var icc = navigator.mozIccManager.getIccById(id);
      request = icc.readContacts('adn');

      request.onsuccess = onSuccessFunction;
      request.onerror = onErrorFunction;

    }
  }

  if (presentCards === 0) {
    this.getContactsFromOS();
  }



};

/**
 * @access public
 * @description TODO
 */

Contacts.prototype.putContactsOnSD = function(oncomplete) {
  var that = this;
  this.clean(function(err) {
    var sdcard = navigator.getDeviceStorages('sdcard')[1];


    //var sdcard = ffosbr.media.getStorageByName('sdcard').external;   
    file = new Blob([JSON.stringify(that.contacts)], {
      type: 'text/json'
    });

    var sdcardAvailable = sdcard.available();

    sdcardAvailable.onsuccess = function() {
      if (this.result == 'available') {
        var request = sdcard.addNamed(file, 'backup/contacts/contacts.json');
        request.onsuccess = function() {
          if (window.ffosbr.utils.isFunction(oncomplete)) {
            oncomplete();
          }
        };

        // An error typically occur if a file with the same name already exist
        request.onerror = function() {
          console.log('error in putcontactsonSD');
          console.log(request);
          var error = this.error;
          if (window.ffosbr.utils.isFunction(oncomplete)) {
            oncomplete(error);
          }
        };
      } else if (this.result == 'unavailable') {
        console.log('The SDcard on your device is not available');
      } else {
        console.log('The SDCard on your device is shared and thus not available');
      }
    };

    sdcardAvailable.onerror = function() {
      console.warn('SDcard Error');
    };


  });
};

// Defines Ffosbr contact
module.exports = new Contacts();
