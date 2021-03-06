var componentElementMap = {
  'raw': ['commandInput', 'runInTerminalDiv']
};

main();

function main() {

  // socket connection to http server
  socket = io();
  socket.on('message', console.dir);
  socket.send('ping');

  // display command results received from robot
  socket.on('command result', (result)=>{
    console.dir('command result');
    console.dir(result);
    addMessage(result.data, false);
  });

  // render map data received from robot
  socket.on('map data', (mapData)=>{
    console.dir('map data');
    console.dir(mapData);
    addShapeVoxels(mapData.data, mapData.robot);
  });

  // render block data received from robot
  socket.on('block data', (blockData)=>{
    console.dir('block data');
    console.dir(blockData);
    var pos = new WorldAndScenePoint(blockData.data.point, true);
    if (!(blockData.data.name == "minecraft:air")) {
      addVoxel(pos, colorFromHardness(blockData.data.hardness));
    }
    else {removeVoxel(pos);}
  });

  // render map data received from robot
  socket.on('robot position', (pos)=>{
    console.dir('robot position');
    console.dir(pos);
    moveRobotVoxel(new WorldAndScenePoint(pos.data, true), pos.robot);
    allRobotInfo[pos.robot].removeAllExternalInventories();
    if (pos.robot == document.getElementById('robotSelect').value) {
      var robotData = allRobotInfo[pos.robot];
      if (robotData) {
        selectedRobotMesh.position.copy(robotData.getPosition().scene());
        requestRender();
      }
    }
  });

  // remove selection because its task has been completed
  socket.on('delete selection', (index)=>{
    console.dir('delete selection');
    console.dir(index);
    deleteSelection(selections, index.data);
  });

  // remove voxels corresponding to successfully dug blocks
  socket.on('dig success', (pos)=>{
    console.dir('dig success');
    console.dir(pos);
    removeVoxel(new WorldAndScenePoint(pos.data, true));
  });

  // render inventory data received from robot
  socket.on('inventory data', (inventoryData)=>{
    
    console.dir('inventory data');
    console.dir(inventoryData);
    
    var inventoryContainer = document.getElementById('inventoryContainer');
    var inventorySide = inventoryData.data.side;
    if (!allRobotInfo[inventoryData.robot].getInventory(inventorySide)) {
      var inv = new Inventory(inventoryData.data);
      allRobotInfo[inventoryData.robot].addInventory(inv);
      if (document.getElementById('robotSelect').value == inventoryData.robot) {
        inv.addToDisplay(inventoryContainer);
      }
    }

    // reveal inventories when any change occurs
    if (!allRobotInfo[inventoryData.robot].getShowInventories()) {
      allRobotInfo[inventoryData.robot].toggleShowInventories();
    }
    inventoryContainer.classList.remove('hidden');
    // get the robot's inventory if we didn't have it yet
    if (!allRobotInfo[inventoryData.robot].getInventory(-1)) {
      sendCommand('viewInventory');
    }

  });

  // todo
  socket.on('slot data', (slot)=>{
    console.dir('slot data');
    console.dir(slot);
    allRobotInfo[slot.robot]
      .getInventory(slot.data.side)
      .setSlot(slot.data.slotNum, slot.data.contents);
  });

  // add listening robots to select
  socket.on('listen start', (data)=>{
    console.dir('listen start');
    console.dir(data);
    var robotSelect = document.getElementById('robotSelect');
    if (!robotSelect.querySelector('[value=' + data.robot + ']')) {
      var option = document.createElement('option');
      option.text = data.robot;
      option.value = data.robot;
    }
    if (!allRobotInfo[data.robot]) {allRobotInfo[data.robot] = new Robot();}
    robotSelect.add(option);
    if (robotSelect.options.length <= 2) {
      option.selected = true;
    }
  });
  
  // remove robots that stop listening from select
  socket.on('listen end', (data)=>{
    console.dir('listen end');
    console.dir(data);
    var robotSelect = document.getElementById('robotSelect');
    var option = robotSelect.querySelector('[value=' + data.robot + ']');
    allRobotInfo[data.robot] = undefined;
    // if the disconnecting robot is the currently selected robot
    if (robotSelect.value == data.robot) {
      robotSelect.value = '';
      selectedRobotMesh.visible = false;
      requestRender();
    }
    robotSelect.removeChild(option);
  });
  
  // keep track of how much power robots have left
  socket.on('power level', (power)=>{
    console.dir('power level');
    console.dir(power);
    allRobotInfo[power.robot].setPower(power.data);
    var currentRobot = document.getElementById('robotSelect').value;
    if (power.robot == currentRobot) {
      setPower(power.data);
    }
  });

  socket.on('available components', (components)=>{
    console.dir('available components');
    console.dir(components);
    allRobotInfo[components.robot].setComponents(components.data);
    if (components.robot == document.getElementById('robotSelect').value) {
      hideComponentGUI();
      for (componentName in allRobotInfo[components.robot].getComponents()) {
        var componentElementIDs = componentElementMap[componentName];
        componentElementIDs.map((componentElementID)=>{
          document.getElementById(componentElementID).classList.remove('hidden');
        });
      }
    }
  });

  selectStart.addEventListener('input', ()=>{removeSelectBox(); requestRender()});
  selectEnd.addEventListener('input', ()=>{removeSelectBox(); requestRender()});

  var toolButtonListeners = [
    {buttonID: 'moveTool', eventListener: clearSelection},
    {buttonID: 'interactTool', eventListener: clearSelection},
    {buttonID: 'inspectTool', eventListener: clearSelection},
    {buttonID: 'digTool', eventListener: ()=>{clearSelection(); slowRender();}},
    {buttonID: 'placeTool', eventListener: ()=>{clearSelection(); slowRender();}}
  ];

  for (var toolButtonInfo of toolButtonListeners) {
    var button = document.getElementById(toolButtonInfo.buttonID).parentElement;
    button.addEventListener('click', toolButtonInfo.eventListener);
  }

  initPointerLock();
  initCommandInput();
  initClickTools();
  initSelectAreaTools();
  initCraftSelect();
  initRobotSelect();
  initCutawayForm();
  initModal();

}

function clearSelection() {
  selectStart.clear();
  selectEnd.clear();
  removeSelectBox();
  slowRender();
}

// for some reason the click event fires before the checked attribute changes
// can't find an event for when that attribute changes, so we use setTimeout  
function slowRender() {
  setTimeout(requestRender, 10);
}

/**
 * Allows specifying an area of voxels. Used for digging and placing blocks.
 */
function initSelectAreaTools() {
  renderer.domElement.addEventListener('click', (e)=>{
    // left click
    if (e.button == 0) {
      var digToolActive = document.getElementById('digTool').checked;
      var placeToolActive = document.getElementById('placeTool').checked;
      if (controls.enabled && (digToolActive || placeToolActive)) {
        var pos = new WorldAndScenePoint(rollOverMesh.position, false);
        if (!selectStart.isComplete()) {
          selectStart.setFromPoint(pos);
        }
        else if (!selectEnd.isComplete()) {
          selectEnd.setFromPoint(pos);
        }
        else {
          var startPoint = selectStart.getPoint();
          var endPoint = selectEnd.getPoint();

          var selection = makeBoxAround(startPoint, endPoint, rollOverMaterial);
          scene.add(selection);
          var selectionIndex = addSelection(selections, selection);
          
          var startPointLua = objectToLuaString(startPoint.world());
          var endPointLua = objectToLuaString(endPoint.world());
          var scanLevel = document.getElementById('scanLevelSelect').value;
          
          if (digToolActive) {
            var commandName = 'dig';
          }
          else if (placeToolActive) {
            var commandName = 'place';
          }
          var commandParameters = [startPointLua, endPointLua, selectionIndex, scanLevel];
          sendCommand(commandName, commandParameters);

          selectStart.clear();
          selectEnd.clear();
        }
      }
    }
    // right click
    else if (e.button == 2) {
      clearSelection();
    }
  });
}

/**
 * Adds command sending functionality to the command input.
 */
function initCommandInput() {

  var commandInput = document.getElementById('commandInput');
  commandInput.addEventListener("keydown", (event)=>{
    var runInTerminal = document.getElementById('runInTerminal');
    if (event.keyCode == 13) { // enter
      event.preventDefault();
      var baseText = event.target.value;
      var commandText = baseText;
      if (runInTerminal.checked) {
        commandText = "runInTerminal('" + commandText + "')";
      }
      commandText = "return " + commandText;

      var commandName = 'raw';
      var commandParameters = [commandText];
      sendCommand(commandName, commandParameters, runInTerminal.checked);

      // clear input text
      event.target.value = '';
    }
    else if (event.key == "Tab") {
      event.preventDefault();
      runInTerminal.checked = !runInTerminal.checked;
    }
  });

}

/**
 * Sends a command to robots telling them to move to the coordinate clicked on,
 * and then do something depending on the selected tool.
 */
function initClickTools() {
  renderer.domElement.addEventListener('click', ()=>{
    var moveToolActive = document.getElementById('moveTool').checked;
    var interactToolActive = document.getElementById('interactTool').checked;
    var inspectToolActive = document.getElementById('inspectTool').checked;
    if (controls.enabled && (moveToolActive || interactToolActive || inspectToolActive)) {
      var coord = new WorldAndScenePoint(rollOverMesh.position, false).world();
      console.log(coord);
      var scanLevel = document.getElementById('scanLevelSelect').value;
      if (moveToolActive) {
        var commandName = 'move';
        var commandParameters = [coord.x, coord.y, coord.z, scanLevel];
      }
      else if (interactToolActive) {
        var commandName = 'interact';
        var commandParameters = [objectToLuaString(coord), scanLevel];
      }
      else if (inspectToolActive) {
        var commandName = 'inspect';
        var commandParameters = [objectToLuaString(coord), scanLevel];
      }
      sendCommand(commandName, commandParameters);
    }
  });
}

/**
 * Sends a command for the selected robot to the server.
 * @param {string} commandName 
 * @param {any[]} commandParameters
 * @param {boolean} runInTerminal
 * @returns {boolean}
 */
function sendCommand(commandName, commandParameters, runInTerminal) {
  var result = false;
  var robotSelect = document.getElementById('robotSelect');
  if (!robotSelect.value) {
    console.dir('No robot selected!');
  }
  else {
    var commandString = commandName + "(" + (commandParameters || "") + ")"
    commandParameters = Array.isArray(commandParameters) ? commandParameters : [];
    addMessage(commandString, true, runInTerminal, commandName, commandParameters);
    socket.emit('command', {command: {name: commandName, parameters: commandParameters}, robot: robotSelect.value});
    result = true;
  }
  return result;
}

/**
 * Used to display on the web client commands sent to and received from robots.
 * @param {string | any[]} message 
 * @param {boolean} isInput 
 * @param {boolean} checked 
 * @param {string} commandName
 * @param {any[]} commandParameters
 */
function addMessage(message, isInput, checked, commandName, commandParameters) {

  var element = document.createElement('div');
  element.classList.add('message');

  if (isInput) {
    var subClass = 'input';
    element.setAttribute("data-checked", checked);
    element.setAttribute("data-command-name", commandName);
    element.setAttribute("data-command-parameters", JSON.stringify(commandParameters));

    element.addEventListener('click', (event)=>{

      var commandInput = document.getElementById('commandInput');

      var checkData = event.target.getAttribute("data-checked");
      var wasChecked = checkData == "true" ? true : false;
      var runInTerminal = document.getElementById("runInTerminal");
      runInTerminal.checked = wasChecked;

      var commandName = event.target.getAttribute("data-command-name");
      var commandParameters = JSON.parse(event.target.getAttribute("data-command-parameters"));
      if (commandName) {sendCommand(commandName, commandParameters);}

    });

    element.appendChild(document.createTextNode(message));
  }

  else {
    var subClass = 'output';
    element.appendChild(renderCommandResponse(message));
  }

  element.classList.add(subClass);
  var messageContainer = document.getElementById('messageContainer');
  messageContainer.insertBefore(element, messageContainer.firstChild);
  messageContainer.insertBefore(document.createElement('br'), messageContainer.firstChild);

}

/**
 * Used by addMessage to ensure newlines in messages sent from robots display properly in the web client.
 * @param {any[]} data 
 * @returns {HTMLDivElement}
 */
function renderCommandResponse(data) {
  var outputMessageDiv = document.createElement('div');
  var text = data[0] + '\n' + data[1];
  for (var line of text.split('\n')) {
    line = line.replace(/\s/g, '\u00A0')
    outputMessageDiv.appendChild(document.createTextNode(line));
    outputMessageDiv.appendChild(document.createElement('br'));
  }
  outputMessageDiv.lastChild.remove();
  return outputMessageDiv;
}

/**
 * Allows enabling and disabling of the camera controls.
 */
function initPointerLock() {
  // locking/unlocking the cursor, enabling/disabling controls
  if ('pointerLockElement' in document) {

    var pointerLockElement = renderer.domElement;

    function pointerLockChangeCB(event) {
      if (document.pointerLockElement === pointerLockElement) {controls.enabled = true;}
      else {controls.enabled = false;}
    }

    // Hook pointer lock state change events
    document.addEventListener( 'pointerlockchange', pointerLockChangeCB, false );
    document.addEventListener( 'pointerlockerror', console.dir, false );

    pointerLockElement.addEventListener('click', function(event) {
      pointerLockElement.requestPointerLock();
    }, false);

    var clickThroughElements = ['bottomLeftUI', 'messageContainer', 'inventoryContainer', 'buttonContainer'];
    for (elemName of clickThroughElements) {
      let clickThroughElem = document.getElementById(elemName);
      clickThroughElem.addEventListener('click', function(event) {
        if (event.target == clickThroughElem) {
          pointerLockElement.requestPointerLock();
        }
      }, false);
    }

  }
  else {alert("Your browser doesn't seem to support Pointer Lock API");}
}

/**
 * Makes the crafting button tell the robot to craft whatever's selected.
 */
function initCraftSelect() {
  var craftSelect = document.getElementById("craftSelect");

  function addRecipes(recipes) {
    var recipeNames = [];
    for (var recipe of recipes) {
      for (var recipeName of getRecipeNames(recipe)) {
        if (recipeNames.indexOf(recipeName) == -1) {
          recipeNames.push(recipeName);
        }
      }
    }
    recipeNames.sort();
    for (var recipeName of recipeNames) {
      var option = document.createElement('option');
      option.textContent = recipeName;
      craftSelect.appendChild(option);
    }
    $('.selectpicker').selectpicker('refresh');
  }
  
  fetchPromise("/js/recipes/minecraftRecipes.json").then(addRecipes).catch(console.dir);
  fetchPromise("/js/recipes/OCRecipes.json").then(addRecipes).catch(console.dir);

  // prevent hotkeys from working here
  craftSelect.parentElement.addEventListener('keydown', (e)=>{e.stopPropagation();});

  var craftButton = document.getElementById("craftButton");
  craftButton.addEventListener('click', (e)=>{
    
    var craftSelect = document.getElementById("craftSelect");
    var commandName = 'craft';
    var commandParameters = [craftSelect.value];
    sendCommand(commandName, commandParameters);

  });

}

/**
 * Update the UI to show the new robot's information.
 * @param {string} robotName 
 */
function switchToRobot(robotName) {
  var robotData = allRobotInfo[robotName];
  if (robotData) {

    var powerLevel = robotData.getPower();
    if (powerLevel) {
      setPower(powerLevel);
    }
    
    var inventoryContainer = document.getElementById("inventoryContainer");
    if (robotData.getShowInventories()) {
      inventoryContainer.classList.remove('hidden');
      sendCommand('viewInventory');
    }
    else {
      inventoryContainer.classList.add('hidden');
    }

    for (elem of Array.from(inventoryContainer.childNodes)) {
      elem.remove();
    }
    allRobotInfo[robotName].getAllInventories().map(i=>i.addToDisplay(inventoryContainer));

    var robotPos = robotData.getPosition();
    if (robotPos) {
      selectedRobotMesh.position.copy(robotPos.scene());
      selectedRobotMesh.visible = true;
      requestRender();
    }

    hideComponentGUI();
    for (componentName in robotData.getComponents()) {
      var componentElementIDs = componentElementMap[componentName];
      componentElementIDs.map((componentElementID)=>{
        document.getElementById(componentElementID).classList.remove('hidden');
      });
    }

  }
  else {
    selectedRobotMesh.visible = false;
    requestRender();
  }
}

/**
 * Used when robots update their power level and when we switch robots.
 * Takes a number from 0 to 1.
 * @param {number} powerLevel
 */
function setPower(powerLevel) {
  document.getElementById('powerLevelDisplay').classList.remove('hidden');
  document.getElementById('powerLevel').innerHTML = Math.round(powerLevel * 100) + "%";
}

/**
 * Hides certain GUI elements when a robot that can't make use of them is selected.
 */
function hideComponentGUI() {
  for (componentElementIDs of Object.values(componentElementMap)) {
    componentElementIDs.map((componentElementID)=>{
      var componentElement = document.getElementById(componentElementID);
      if (!componentElement.classList.contains('hidden')) {
        componentElement.classList.add('hidden');
      }
    });
  }
}

/**
 * Makes sure the UI updates properly when we change the selected robot.
 */
function initRobotSelect() {
  var robotSelect = document.getElementById('robotSelect');
  robotSelect.addEventListener('change', (e)=>{
    console.log(e.target.value);
    switchToRobot(e.target.value);
  });
}

/**
 * Moves the camera above the selected robot and faces it.
 */
function viewSelectedRobot() {
  var robotData = allRobotInfo[document.getElementById('robotSelect').value];
  goToAndLookAt(controls, robotData.getPosition());
  requestRender();
}

/**
 * Used to update the map whenever we specify a new cutoff point.
 */
function initCutawayForm() {
  cutawayForm.addChangeListener((e)=>{
    voxelMap.forEach((voxel)=>{
      voxel.visible = cutawayForm.shouldBeRendered(new WorldAndScenePoint(voxel.position, false));
    });
    requestRender();
  });
}

/**
 * Display the controls if the user hasn't visited the page before.
 */
function initModal() {
  if (!localStorage.getItem('controlsHaveBeenShown')) {
    $('#controlsDisplay').modal('show');
    localStorage.setItem('controlsHaveBeenShown', 'true');
  }
}