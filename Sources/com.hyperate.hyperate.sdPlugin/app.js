var support = "MozWebSocket" in window ? 'MozWebSocket' : ("WebSocket" in window ? 'WebSocket' : null);
var apikey = config.SECRET_API_KEY;
var hrimage = config.HRimg;
var id = "";
var payload
function enableHypeRate() {
    const hypeRateURL =
      "wss://app.hyperate.io/socket/websocket?token=" + apikey;
    window.hypeRateSocket = new WebSocket(hypeRateURL);
    // Set hearbeat interval on connect
    window.hypeRateSocket.onopen = () => {
      console.log(`HypeRate WebSocket - Connected`);
      setInterval(function () {
        hypeRateSocket.send(
          JSON.stringify({
            topic: "phoenix",
            event: "heartbeat",
            payload: {},
            ref: 0,
          })
        );
      }, 10000);
      connectToHypeRate(id);
    };
    // Handle incoming message
    window.hypeRateSocket.onmessage = (event) => {
      let eventData = JSON.parse(event.data);
      if (eventData.event !== "hr_update") {
        return;
      }
      $SD.api.setTitle(payload, eventData.payload.hr);
      console.log(eventData.payload.hr);
    };
    // Reconnect on disconnect
    window.hypeRateSocket.onclose = function (event) {
      console.error(`HypeRate Error: ${event.code} ${event.reason}`);
      enableHypeRate();
    };
  }
  async function connectToHypeRate(sessionID) {
    console.log(`HypeRate - Joining ${sessionID}`);
    joinHypeRateChannel();
  }
  // Join the HypeRate Id on WebSocket
  async function joinHypeRateChannel() {
    window.hypeRateSocket.send(
      JSON.stringify({
        topic: `hr:${id}`,
        event: "phx_join",
        payload: {},
        ref: 0,
      })
    );
  }

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(data) {
    // Subscribe to the willAppear and other events
    $SD.on('com.hyperate.hyperate.heartrate.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.keyUp', (jsonObj) => action.onKeyUp(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.propertyInspectorDidAppear', (jsonObj) => {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]propertyInspectorDidAppear:');
    });
    $SD.on('com.hyperate.hyperate.heartrate.propertyInspectorDidDisappear', (jsonObj) => {
        console.log('%c%s', 'color: white; background: red; font-size: 13px;', '[app.js]propertyInspectorDidDisappear:');
    });
    action.setTitle(data);
};

// ACTIONS

const action = {
    settings:{},
    onDidReceiveSettings: function(jsn) {
        console.log('%c%s', 'color: white; background: red; font-size: 15px;', '[app.js]onDidReceiveSettings:');

        this.settings = Utils.getProp(jsn, 'payload.settings', {});
        this.doSomeThing(this.settings, 'onDidReceiveSettings', 'orange');

        /**
         * In this example we put a HTML-input element with id='mynameinput'
         * into the Property Inspector's DOM. If you enter some data into that
         * input-field it get's saved to Stream Deck persistently and the plugin
         * will receive the updated 'didReceiveSettings' event.
         * Here we look for this setting and use it to change the title of
         * the key.
         */

         //this.setTitle(jsn);
    },

    /** 
     * The 'willAppear' event is the first event a key will receive, right before it gets
     * shown on your Stream Deck and/or in Stream Deck software.
     * This event is a good place to setup your plugin and look at current settings (if any),
     * which are embedded in the events payload.
     */

    onWillAppear: function (jsn) {
        console.log("You can cache your settings in 'onWillAppear'", jsn.payload.settings);
        /**
         * The willAppear event carries your saved settings (if any). You can use these settings
         * to setup your plugin or save the settings for later use. 
         * If you want to request settings at a later time, you can do so using the
         * 'getSettings' event, which will tell Stream Deck to send your data 
         * (in the 'didReceiveSettings above)
         * 
         * $SD.api.getSettings(jsn.context);
        */
        this.settings = jsn.payload.settings;
        console.log("looking for setting", this.settings);
        id = this.settings.HRid;
        
        // Nothing in the settings pre-fill, just something for demonstration purposes
        if (!this.settings || Object.keys(this.settings).length === 0) {
            this.settings.Code = 'HypeRate';
        }
        //this.setTitle(jsn);
    },

    onKeyUp: function (jsn) {
        this.doSomeThing(jsn, 'onKeyUp', 'green'); 
        id = this.settings.HRid;
        payload = jsn.context;
        $SD.api.setImage(payload, hrimage);
        enableHypeRate();
    },

    onSendToPlugin: function (jsn) {
        /**
         * This is a message sent directly from the Property Inspector 
         * (e.g. some value, which is not saved to settings) 
         * You can send this event from Property Inspector (see there for an example)
         */ 

        const sdpi_collection = Utils.getProp(jsn, 'payload.sdpi_collection', {});
        if (sdpi_collection.value && sdpi_collection.value !== undefined) {
            this.doSomeThing({ [sdpi_collection.key] : sdpi_collection.value }, 'onSendToPlugin', 'fuchsia');            
        }
    },

    /**
     * This snippet shows how you could save settings persistantly to Stream Deck software.
     * It is not used in this example plugin.
     */

    saveSettings: function (jsn, sdpi_collection) {
        console.log('saveSettings:', jsn);
        if (sdpi_collection.hasOwnProperty('key') && sdpi_collection.key != '') {
            if (sdpi_collection.value && sdpi_collection.value !== undefined) {
                this.settings[sdpi_collection.key] = sdpi_collection.value;
                console.log('setSettings....', this.settings);
                $SD.api.setSettings(jsn.context, this.settings);
            }
        }
    },

    /**
     * Here's a quick demo-wrapper to show how you could change a key's title based on what you
     * stored in settings.
     * If you enter something into Property Inspector's name field (in this demo),
     * it will get the title of your key.
     * 
     * @param {JSON} jsn // The JSON object passed from Stream Deck to the plugin, which contains the plugin's context
     * 
     */

    setTitle: function(hr) {
        if (this.settings && this.settings.hasOwnProperty('HRid')) {
            console.log("watch the key on your StreamDeck - it got a new title...", hr);
        }
    },

    /**
     * Finally here's a method which gets called from various events above.
     * This is just an idea on how you can act on receiving some interesting message
     * from Stream Deck.
     */

    doSomeThing: function(inJsonData, caller, tagColor) {
        console.log('%c%s', `color: white; background: ${tagColor || 'grey'}; font-size: 15px;`, `[app.js]doSomeThing from: ${caller}`);
        console.log(inJsonData);
    }, 


};