var support = "MozWebSocket" in window ? 'MozWebSocket' : ("WebSocket" in window ? 'WebSocket' : null);
var apikey = config.SECRET_API_KEY;
var hrimage = config.HRimg;
var HRimgbase = config.HRimgbase;
var id = "";
var payload
var streamdeckimage

var keyDown = false;
var keyUp = false;
var allowed = true;
var start;
var millis;
var seconds = 0;
var WSstate = "CLOSED"
var autoreconnect = false;

function Cleartime() {
    millis = "0";
    seconds = "0";
}

function DisconnectHypeRate() {
    hypeRateSocket.close();
    clearInterval(heartbeatInterval);
    WSstate = "CLOSED"
    $SD.api.setImage(payload, HRimgbase);

}

function enableHypeRate() {
    const hypeRateURL =
        "wss://app.hyperate.io/socket/websocket?token=" + apikey;
    window.hypeRateSocket = new WebSocket(hypeRateURL);
    // Set hearbeat interval on connect
    hypeRateSocket.onopen = () => {
        console.log(`HypeRate WebSocket - Connected`);
        heartbeatInterval = setInterval(heartbeat, 10000);
        connectToHypeRate(id);
        WSstate = "connected"
    };

    function heartbeat() {
        hypeRateSocket.send(JSON.stringify({
            topic: "phoenix",
            event: "heartbeat",
            payload: {},
            ref: 0,
        }));
    }
    // Handle incoming message
    window.hypeRateSocket.onmessage = (event) => {
        let eventData = JSON.parse(event.data);
        if (eventData.event !== "hr_update") {
            return;
        }
        makeimage(eventData.payload.hr);
    };
    // Reconnect on disconnect
    window.hypeRateSocket.onclose = function(event) {
        console.error(`HypeRate Error: ${event.code} ${event.reason}`);
        if (autoreconnect) {
            enableHypeRate();
        } else {
            console.error("Reconnect Set to False");
        }
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

function makeimage(heartrate) {

    let elem = document.querySelector("canvas");
    let ctx = elem.getContext("2d");

    var image = new Image();
    image.onload = function() {
        ctx.drawImage(image, 0, 0);
        ctx.font = "bold 50px Arial";

        let pulse = heartrate;
        let measurements = ctx.measureText(pulse);

        let text_width = measurements.width;
        let text_height = measurements;

        let canvas_width = elem.width;
        let canvas_height = elem.height;

        ctx.fillStyle = "white";
        ctx.fillText(pulse, (canvas_width - text_width) / 2, canvas_height / 2 + 15);

        ctx.fillStyle = "white";
        ctx.font = "bold 30px Arial";
        ctx.fillText("BPM", 42, 120);

        // Result here
        streamdeckimage = elem.toDataURL();
        $SD.api.setImage(payload, streamdeckimage);
    };
    image.src = hrimage;
}

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(data) {
    // Subscribe to the willAppear and other events
    $SD.on('com.hyperate.hyperate.heartrate.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.keyUp', (jsonObj) => action.onKeyUp(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.keyDown', (jsonObj) => action.onkeyDown(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
    $SD.on('com.hyperate.hyperate.heartrate.propertyInspectorDidAppear', (jsonObj) => {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]propertyInspectorDidAppear:');
    });
    $SD.on('com.hyperate.hyperate.heartrate.propertyInspectorDidDisappear', (jsonObj) => {
        console.log('%c%s', 'color: white; background: red; font-size: 13px;', '[app.js]propertyInspectorDidDisappear:');
    });
};

// ACTIONS

const action = {
    settings: {},
    onDidReceiveSettings: function(jsn) {
        console.log('%c%s', 'color: white; background: red; font-size: 15px;', '[app.js]onDidReceiveSettings:');

        this.settings = Utils.getProp(jsn, 'payload.settings', {});
        this.doSomeThing(this.settings, 'onDidReceiveSettings', 'orange');
    },

    onWillAppear: function(jsn) {
        console.log("You can cache your settings in 'onWillAppear'", jsn.payload.settings);
        this.settings = jsn.payload.settings;
        console.log("looking for setting", this.settings);
        id = this.settings.HRid;
    },

    onKeyUp: function(jsn) {
        this.doSomeThing(jsn, 'onKeyUp', 'green');
        id = this.settings.HRid;
        payload = jsn.context;

        keyDown = false;
        keyUp = true;
        millis = Date.now() - start;
        seconds = Math.floor(millis / 1000);

        if (seconds > 5) {
            console.log("LongPress");
            setTimeout(Cleartime, 2000);
            autoreconnect = false;
            DisconnectHypeRate();
        }
        if (seconds < 5 && WSstate == "CLOSED") {
            console.log("Shortpress");
            setTimeout(Cleartime, 2000);
            autoreconnect = true;
            enableHypeRate();
        };
    },

    onkeyDown: function(jsn) {
        this.doSomeThing(jsn, 'onKeydown', 'green');

        allowed = false;
        keyDown = true;
        keyUp = false;
        start = Date.now();
    },
    onSendToPlugin: function(jsn) {
        const sdpi_collection = Utils.getProp(jsn, 'payload.sdpi_collection', {});
        if (sdpi_collection.value && sdpi_collection.value !== undefined) {
            this.doSomeThing({
                [sdpi_collection.key]: sdpi_collection.value
            }, 'onSendToPlugin', 'fuchsia');
        }
    },

    saveSettings: function(jsn, sdpi_collection) {
        console.log('saveSettings:', jsn);
        if (sdpi_collection.hasOwnProperty('key') && sdpi_collection.key != '') {
            if (sdpi_collection.value && sdpi_collection.value !== undefined) {
                this.settings[sdpi_collection.key] = sdpi_collection.value;
                console.log('setSettings....', this.settings);
                $SD.api.setSettings(jsn.context, this.settings);
            }
        }
    },

    setTitle: function(hr) {
        if (this.settings && this.settings.hasOwnProperty('HRid')) {
            console.log("watch the key on your StreamDeck - it got a new title...", hr);
        }
    },

    doSomeThing: function(inJsonData, caller, tagColor) {
        console.log('%c%s', `color: white; background: ${tagColor || 'grey'}; font-size: 15px;`, `[app.js]doSomeThing from: ${caller}`);
        console.log(inJsonData);
    },

};