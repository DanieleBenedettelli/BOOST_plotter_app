var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var originalContext = canvas.getContext("2d");
var inputFile = document.getElementById("file-input");
var thresholdSlider = document.getElementById("threshold-slider");
var penSizeSlider = document.getElementById("stroke-slider");

var connectButton = document.getElementById("toggleConnection");
var loadButton = document.getElementById("loadPaper");
var drawButton = document.getElementById("draw");
var stopButton = document.getElementById("stop");
//var previewButton = document.getElementById("preview");
var fitButton = document.getElementById("fit");
//var clearButton = document.getElementById("clear");
//var progressBar = document.getElementById("progressBar");
var statusLabel = document.getElementById("statusLabel");
var plotterImage = document.getElementById("plotterImage");
//progressBar.style.visibility = "hidden";
//progressBar.value = 0;

var threshold = 60;
var defaultSize = {w:96, h:126};
//var defaultSize = {w:192, h:252};
var imWidth = 100;
var imHeight = 100;
var ratio = 1.0;
var penSize = 1; // tenths mm // value from 1 (0.1mm) to 20 (2mm)
var scale = 1.0;

loadButton.disabled = true;
drawButton.disabled = true;
stopButton.disabled = true;
//previewButton.disabled = true;
fitButton.disabled = true;
//clearButton.disabled = true;
canvas.style.display = "none";

var connected = false;
var paperLoaded = false;
var imageLoaded = false;

var offsetFromLeft = 0;
var offsetFromTop = 0;
var sourceCropWidth = 100;
var sourceCropHeight = 100;
var imageMaxDim = 0;
var imageMinDim = 0;
var canvasMaxDim = 126;
var canvasMinDim = 96;
var canvasAspectRatio = 1;
var imageAspectRatio = 1;
var scaleMin = 1;

const mmToDegreesX = 10;
const mmToDegreesY = 12;
const pixelToDegreesX = 5;
const pixelToDegreesY = 6;

var currentColor = 0;
var X0 = 0;
var Y0 = 0;
var Z0 = 0;

var image = new Image();
var date = new Date();

var plotter;
var motorZ;
var motorY; 
var motorX;
var colorSensor;
var led;


const poweredUP = new PoweredUP.PoweredUP();

const fitImage = function () {
	scale = 1/ratio;
	updateImage();
}

const thresholdCheckBox = function() {
	var checkBox = document.getElementById("thresholdCb");
	if (checkBox.checked == true){
		console.log("filtering enabled");
	} else {
		console.log("filtering disabled");
	}
	updateImage();
}

const toggleConnection = function () {
	if (connected) disconnect();
	else scan();
}

const disconnect = function() {
	plotter.disconnect();
	console.log("Hub disconnected!");
	statusLabel.innerHTML = "Disconnected";
	connected = false;
	loadButton.disabled = true;
	drawButton.disabled = true;
	stopButton.disabled = true;	
}

const scan = function () {
	//poweredUP.scan(); // Start scanning for hubs
    
	if (PoweredUP.isWebBluetooth) {
        poweredUP.scan(); // Start scanning for hubs
    } else {
        alert("Your browser does not support the Web Bluetooth specification. Maybe you should just forgot https://");
    }
	
}

canvas.ondragstart = function() {
  return false;
}

const zoom = function(delta) {
	var inc = 0.1;
    if (scale>15) inc = 1;
	scale += Math.sign(delta) * inc;

   // Restrict scale
   scale = Math.min(Math.max(.1, scale), 2/ratio);
   //console.log("new scale: "+scale);
   updateImage();	
}

const zoomWheel = function(event) {
	event.preventDefault();
	zoom(event.deltaY);
}

var dragged = false;
var dragX0 = 0;
var dragY0 = 0;

// TODO update image while dragging it

canvas.onmousedown = function(event) {
  //canvas.style.position = 'absolute';
  //canvas.style.zIndex = 1000;
	dragged = true;
	dragX0 = event.pageX - canvas.getBoundingClientRect().x;
	dragY0 = event.pageY - canvas.getBoundingClientRect().y;
	//console.log("start drag at ["+dragX0+", "+dragY0+" ]");
}

canvas.onmouseup = function(event) {
	dragged = false;
	var x1 = event.pageX - canvas.getBoundingClientRect().x;
	var y1 = event.pageY - canvas.getBoundingClientRect().y;
	offsetFromLeft += (x1-dragX0)*scale;
	offsetFromTop += (y1-dragY0)*scale;
	//console.log("end drag at ["+x1+", "+y1+" ]");
	console.log("offset ["+offsetFromLeft+", "+offsetFromTop+" ]");
	updateImage();
}

/*
canvas.onmousedown = function(event) {
  // (1) prepare to moving: make absolute and on top by z-index
  canvas.style.position = 'absolute';
  canvas.style.zIndex = 1000;

  // move it out of any current parents directly into body
  // to make it positioned relative to the body
  //document.body.append(ball);

  // centers the ball at (pageX, pageY) coordinates
  function moveAt(pageX, pageY) {
    //canvas.style.left = pageX - canvas.offsetWidth / 2 + 'px';
    //canvas.style.top = pageY - canvas.offsetHeight / 2 + 'px';
	offsetFromLeft = pageX - canvas.offsetWidth / 2;
	offsetFromTop = pageY - canvas.offsetHeight / 2;
	console.log("click at: " + pageX + " ," + pageY);
	console.log("offset: [ "+offsetFromLeft + ", "+ offsetFromTop + " ]");
  }

  // move our absolutely positioned ball under the pointer
  moveAt(event.pageX, event.pageY);

  function onMouseMove(event) {
    moveAt(event.pageX, event.pageY);
  }

  // (2) move the ball on mousemove
  document.addEventListener('mousemove', onMouseMove);

  // (3) drop the ball, remove unneeded handlers
  canvas.onmouseup = function() {
    document.removeEventListener('mousemove', onMouseMove);
    canvas.onmouseup = null;
  };
};
*/

poweredUP.on("discover", async function(hub) { // Wait to discover hubs
	console.log(" poweredUP on discover");
	
	plotter = hub;
	
    hub.on("disconnect", function() {
        console.log(`Disconnected ${plotter.name}`);
		connectButton.innerText = "Connect";
    });	
	
    hub.on("attach", function(device) {
        console.log(`Device ${device.typeName} attached to port ${device.portName}`) ;
				
		if (device.typeName=='MOVE_HUB_MEDIUM_LINEAR_MOTOR' && device.portName=='A') {
			motorZ = device;
			//console.log('motor attached to port A:' + device);
		}
		if (device.typeName=='MOVE_HUB_MEDIUM_LINEAR_MOTOR' && device.portName=='B') {
			motorY = device;
			//console.log('motor attached to port B:' + device);
		}	
		if (device.typeName=='MEDIUM_LINEAR_MOTOR' && device.portName=='C') {
			motorX = device;
			//console.log('motor attached to port C:' + device);
		}	
		
		if (device.typeName=='COLOR_DISTANCE_SENSOR' && device.portName=='D') {
			colorSensor = device;
			//console.log('color sensor attached to port D:' + device);
		}			
			
    });

    hub.on("detach", function(device) {
        console.log(`Device ${device.typeName} detached from port ${device.portName}`) ;
    });

	
	await plotter.connect(); // Connect to hub
    led = await plotter.waitForDeviceByType(PoweredUP.Consts.DeviceType.HUB_LED);
    led.setColor(PoweredUP.Consts.Color.RED);	
	connected = true;
    console.log(`Connected to ${plotter.name}!`);
	loadButton.disabled = false;
	//drawButton.disabled = false;
	stopButton.disabled = false;
	connectButton.innerText = "Disconnect";
	statusLabel.innerHTML = "Connected";
	
	// had to do this because the attach notification go missing at connection
	setTimeout( function(){
					plotter.manuallyAttachDevice(39,0); // internal motor to port A
					plotter.manuallyAttachDevice(39,1); // internal motor to port B
					plotter.manuallyAttachDevice(38,2); // external motor to port C
					plotter.manuallyAttachDevice(37,3); // color distance sensor to port D 
				}, 2000);//wait 2 seconds
	


/*
    hub.on("tilt", (device, { x, y, z }) => {
        console.log(`Tilt detected on port ${device.portName} (X: ${x}, Y: ${y}${z !== undefined ? `, Z: ${z}`: ""})`);
    });

    hub.on("distance", (device, { distance }) => {
        console.log(`Motion detected on port ${device.portName} (Distance: ${distance})`);
    });

*/	
/*
	hub.on("colorAndDistance", (device, { color, distance }) => {
        console.log(`Motion detected on port ${device.portName} (Color: ${color}, Distance: ${distance}))`);
		currentColor = color;
    });
*/
    hub.on("color", function(device, { color }) {
        //console.log(`Color detected on port ${device.portName} (Color: ${color})`);
		currentColor = color;
    });

    hub.on("rotate", function(device, { degrees }) {
        //console.log(`Rotation detected on port ${device.portName} (Degrees: ${degrees})`);
    });
	

    hub.on("button", function({ event }) {
        console.log(`Green button press detected (Event: ${event})`);
		if (event==2) {
			loadPaper();
		}
    });
/*
    hub.on("remoteButton", (device, { event }) => {
        console.log(`Remote control button press detected on port ${device.portName} (Event: ${event})`);
    });
*/
});

const movePen = async function(where, speed = 100) {
	var diff = motorZ.values.rotate.degrees - Z0 + where;
	if (diff<0) {
		diff = -diff;
		speed = -speed;
	}
	await plotter.wait([motorZ.rotateByDegrees(diff,-speed)]);
}

const ejectPaper = async function() {
	paperLoaded = false;
	drawButton.disabled = true;
	//progressBar.style.visibility = "hidden";
	//progressBar.value = 0;	
	await penUp();
	await motorY.setSpeed(-50);
	await plotter.sleep(2000);
	await motorY.setPower(0);
	led.setColor(PoweredUP.Consts.Color.RED);	
}

const moveX = async (where, speed = 100) => {
	var diff = motorX.values.rotate.degrees - X0 - pixelToDegreesX*where;
	if (diff<0) {
		diff = -diff;
		speed = -speed;
	}
	await plotter.wait([motorX.rotateByDegrees(diff,-speed)]);
}

const moveY = async (where, speed = 100) => {
	await plotter.wait([motorY.rotateByDegrees(15,100)]);
	var diff = motorY.values.rotate.degrees - Y0 - pixelToDegreesY*where;
	//console.log("move Y:"+diff);
	if (diff<0) {
		diff = -diff;
		speed = -speed;
	}
	await plotter.wait([motorY.rotateByDegrees(diff,-speed)]);
}

const moveXY = async (whereX, whereY, speed = 100) => {
	var diffX = motorX.values.rotate.degrees - X0 - pixelToDegreesX*whereX;
	var diffY = motorY.values.rotate.degrees - Y0 - pixelToDegreesY*whereY;
	//var maxDiff = Math.max(diffX, diffY);
	speedX = speedY = speed
	if (diffX<0) {
		diffX = -diffX;
		speedX = -speedX;
	}
	if (diffY<0) {
		diffY = -diffY;
		speedY = -speedY;
	}	
	await plotter.wait([motorX.rotateByDegrees(diffX,-speedX), motorY.rotateByDegrees(diffY,-speedY)]);
}

const penUp = async () => {
	movePen(0,10);
}

const penDown = async () => {
	movePen(35,5);
}

const dot = async () => {
	await movePen(35,5);
	await movePen(0,10);
}

async function resetPen() {
	if (!connected) {
		console.log("connect plotter first!");
		return;
	}
	if (motorZ===undefined || motorX===undefined) {
		console.log("motor not connected!");
		return;
	}		

	motorZ.setPower(40);
	await plotter.sleep(500);
	motorZ.brake();
	Z0 = motorZ.values.rotate.degrees-21;
	await plotter.wait([motorZ.rotateByDegrees(21,-100)]);
	
	motorX.setPower(-40);
	await plotter.sleep(1200);
	motorX.brake(); // brakes
	await plotter.sleep(50);
	X0 = motorX.values.rotate.degrees;

	console.log("reset done!");
	led.setColor(PoweredUP.Consts.Color.GREEN);	
	
	motorX.setAccelerationTime(50);
	motorX.setDecelerationTime(50);
	motorY.setAccelerationTime(0);
	motorY.setDecelerationTime(0);
	motorZ.setAccelerationTime(0);
	motorZ.setDecelerationTime(0);
	motorX.setMaxPower(100);
	motorY.setMaxPower(100);
	motorZ.setMaxPower(100);
}

async function loadPaper() {
	const WHITE = 10;
	const NONE = 0;
	if (!connected) {
		console.log("connect plotter first!");
		return;
	}
	if (colorSensor===undefined || motorY===undefined) {
		console.log("sensor or motor not connected!");
		return;
	}	
	
	await resetPen();
	if (currentColor == WHITE) {
		console.log("paper present. move!");
		motorY.setSpeed(5);
		await plotter.sleep(20);
		console.log("wait no color");
		stopDrawing = false;
		while (currentColor == WHITE && stopDrawing==false) {
			console.log(currentColor);
			await plotter.sleep(20);
		}
		motorY.brake();
		await plotter.sleep(50);
	}
	console.log("wait white");
	motorY.setSpeed(-5);
	await plotter.sleep(20);
	stopDrawing = false;
	while (currentColor != WHITE && stopDrawing==false) {
		//console.log(currentColor);
		await plotter.sleep(20);
	}
	motorY.brake();
	await plotter.sleep(50);
	if (!stopDrawing) {
		Y0 = motorY.values.rotate.degrees - 40*mmToDegreesY;
		await plotter.wait([motorY.rotateByDegrees(40*mmToDegreesY,-30)]);
		statusLabel.innerHTML = "Ready";
		paperLoaded = true;		
	}
	if (connected && paperLoaded && imageLoaded)
		drawButton.disabled = false;
	//while (!motorY._busy) await plotter.sleep(100);
	//while (motorY._busy) await plotter.sleep(100);
	//console.log("Y done moving");
	//Y0 = motorY.values.rotate.degrees;
}


function clearCanvas() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	canvas.width = defaultSize.w;
	canvas.height = defaultSize.h;
	offsetFromLeft = 0;
	offsetFromTop = 0;
	sourceCropWidth = defaultSize.w;
	sourceCropHeight = defaultSize.h;
	//previewButton.disabled = true;
	fitButton.disabled = true;
}

function loadClick() {
	$('#file-input').trigger('click');
}


function updateImage() {
	originalContext.fillStyle = "#FFFFFF";
	originalContext.fillRect(0, 0, canvas.width, canvas.height);
	//originalContext.drawImage(image, 0, 0, imWidth, imHeight);

	var cropX = Math.floor((image.width - canvas.width*scale)/2) - offsetFromLeft;
	var cropY = Math.floor((image.height - canvas.height*scale)/2) - offsetFromTop;
	//if (cropX<0) cropX = 0;
	//if (cropY<0) cropY = 0;
	//console.log("crop: [" + cropX + ", "+ cropY + " ]");
	originalContext.drawImage(image,
        cropX, cropY, // Start from the left and the top of the image (crop),
        canvas.width*scale, canvas.height*scale,   // "Get" a (w * h) area from the source image (crop),
        0, 0,     // Place the result at 0, 0 in the canvas,
        canvas.width, canvas.height); // With as width / height: 100 * 100 (scale)
	//console.log("image size: [ " + Math.floor(canvas.width*scale) + ", " + Math.floor(canvas.height*scale) + " ]");
	//console.log("canvas size: [ " + canvas.width + ", " + canvas.height + " ]");
	
	var checkBox = document.getElementById("thresholdCb");
	//if (!checkBox.checked) return;
	// threshold image
	var d = originalContext.getImageData(0, 0, canvas.width, canvas.height);  // Get image Data from Canvas context
	//console.log("updating image with threshold "+threshold);
	//console.log("data length="+d.data.length)

	for (var i=0; i<d.data.length; i+=4) { // 4 is for RGBA channels
	// R=G=B=R>T?255:0
		d.data[i] = d.data[i+1] = d.data[i+2] = d.data[i+1] > threshold ? 255 : 0;
	}
	
	ctx.putImageData(d, 0, 0);             // Apply threshold conversion

}

var stopDrawing = false;

function stop () {
	stopDrawing = true;
	console.log("Stopped by user!");
}

// TODO to draw with thick pen, I need a gaussian blur smoothing on image (kernel size equal to penSize)
async function draw(withRobot) {
	if (withRobot && plotter.batteryLevel<50) {
		console.log("Battery level ("+plotter.batteryLevel+") is too low!");
		window.alert("Hub battery is too low!");
		//return;
	}
	// scanline algorithm
	var row = 0;
	var col = 0;
	var rowStart = 0;
	var rowEnd = 0;
	var colStart = 0;
	var colEnd = 0;
	var down = true;
	
	updateImage()
	stopDrawing = false;
	var d = ctx.getImageData(0, 0, canvas.width, canvas.height);  // Get image Data from Canvas context
	
	var skipLineData = 4*(penSize-1)*canvas.width;
	
	ctx.strokeStyle = "Cyan";
	ctx.lineWidth = penSize;//penSize;
	ctx.beginPath();
	
	var time0 = new Date().getTime();
	
	if (withRobot) {
		await penUp();
		statusLabel.innerHTML = "Drawing";
		//progressBar.style.visibility = "visible";
		//progressBar.value = 0;
	}
	// TODO skip rows depending on penSize
	// TODO fill holes which are penSize wide
	
	var lastRow = -1;
	for (var i=0; i<d.data.length && stopDrawing==false; i+=4) { // 4 is for RGBA channels
		row = Math.floor(i/(4*canvas.width));
		col = (i - row*4*canvas.width)/4;	
		/*
		if (withRobot) {
			var progressPercent = i*100/d.data.length;
			progressBar.value = progressPercent;
			var elapsedTime = (new Date().getTime() - time0)/1000;
			var remainingTime = (100-progressPercent)*elapsedTime/progressPercent;
			console.log("progress: "+progressPercent);
			console.log("time left: "+remainingTime);	
		}
		*/
		// if you find a black pixel and pen was up
		if (d.data[i]==0 && down==false) { 
			rowStart = row;
			colStart = col;
			//console.log("go to and lower pen at ("+col+","+row+")");
			down = true; // remember pen down
			
			ctx.moveTo(col,row);
			if (withRobot) {
				//await moveXY(col,row);
				await moveX(col);
				if (lastRow!=row) {
					lastRow = row;
					await moveY(row);
					await plotter.sleep(200);
				}
				await penDown();
				await plotter.sleep(300);
			}
		}
		
		// if you find a white pixel and pen was down
		if (d.data[i]==255 && down==true) {
			rowEnd = row;
			colEnd = col;
			var dx = (colEnd-colStart);
			//if (dx>1) {
			//	console.log("move X by "+dx+" and raise pen");
			//}
			//console.log("pen up at ("+col+","+row+")");
			down = false; // remember pen up
			// draw blue line on image
			ctx.lineTo(col,row);
			ctx.stroke();
			if (withRobot) {
				await moveX(col);
				await plotter.sleep(200);
				await penUp();
				await plotter.sleep(200);
			}			

		}		
		
		// reached end of row 
		if (col == (canvas.width-1)) {
			if ( down == true ) { // was drawing
				//console.log("end row");
				//console.log("pen up at ("+col+","+row+")");
				// draw blue line on image
				ctx.lineTo(col,row);
				ctx.stroke();
				down = false;
				if (withRobot) {
					await moveX(col);
					await plotter.sleep(200);
					await penUp();
					await plotter.sleep(200);
				}	
			}
			
			// skip lines because pen is thick
			if ( i < d.data.length-skipLineData) {
				//console.log("skip "+penSize+" lines");
				i += skipLineData;
			} else {
				//console.log("not skipping lines");
			}	 		
		}		

	}
	if (withRobot) {
		await penUp();
		await plotter.sleep(300);
		await moveX(0);
		await ejectPaper();
		statusLabel.innerHTML = "Ready";
	}

}

thresholdSlider.onchange = e => {
	threshold = e.target.value;
	updateImage();
}
	
penSizeSlider.onchange = e => {
	penSize = e.target.value;
	console.log("pen size changed to "+penSize);
	//updateImage();
}

inputFile.onchange = e => {
	// getting a hold of the file reference
	var file = e.target.files[0];

	// setting up the reader
	var reader = new FileReader();
	reader.readAsDataURL(file); // this is reading as data url

	reader.onloadend = e => {
		image.src = e.target.result;
		image.onload = function(ev) {
			imageMaxDim = Math.max(image.width, image.height);
			imageMinDim = Math.min(image.width, image.height);
			canvasMinDim = Math.min(defaultSize.w, defaultSize.h);
			canvasMaxDim = Math.max(defaultSize.w, defaultSize.h);
			canvasAspectRatio = canvas.width/canvas.height;
			imageAspectRatio = image.width/image.height;
			/*
			// don't enlarge image
			if (imageMaxDim < canvasMaxDim) {
				imWidth = image.width;
				imHeight = image.height;
			}
			
			if (imageAspectRatio > 1) {
				console.log("landscape orientation is bad");
			} else {
				console.log("portrait orientation is good");
			}
			*/
			
			//if (imageMaxDim > canvasMaxDim) {
				ratio = canvasMinDim / imageMaxDim;
				imWidth = Math.floor(image.width * ratio);
				imHeight = Math.floor(image.height * ratio);
				console.log("scale at load: "+ratio);
				//cropWindowWidth = Math.floor(image.width * ratio);
				//cropWindowHeight = Math.floor(image.height * ratio);

				scale = 1/ratio;
				//scaleMin = ratio;
			//}
			clearCanvas();
			updateImage();
			//previewButton.disabled = false;
			fitButton.disabled = false;
			imageLoaded = true;
			canvas.style.display = "block";
			canvas.textAlign = "center";
			plotterImage.style.display = "none";
			if (connected && paperLoaded && imageLoaded)
				drawButton.disabled = false;
		}		
	}
}

canvas.addEventListener('wheel', zoomWheel);
