# Roboserver

This program lets you control OpenComputers robots through a simple GUI. No Lua coding necessary!

![A robot being controlled by the Roboserver](public/assets/tree.gif)

## Getting Started

First off, there are two ways to run the Roboserver: as a standalone application, or as a server.

### Standalone

You can download Roboserver for Windows, OS X, or Linux [here](). Unpack and run it when the download finishes. Congratulations, you're halfway done!

### Server

You should probably skip to the Robot section of this readme unless you run your own Minecraft server and want to let your players access the Roboserver from their browser.

1. Install Node.js and npm.
2. Clone this repository.
3. Run ```npm install``` in the project directory.
4. Rename ```public/js/config.example.js``` to ```public/js/config.js``` and optionally change the settings inside.
5. Run ```npm run server``` in the project directory.

Congratulations, you're halfway done!

### Robot

You need a robot with at minimum the following parts:
* Gold Case
* EEPROM (Lua BIOS)
* T2 CPU
* T1 Memory x2
* T1 Hard Disk Drive with OpenOS installed
* Internet Card
* Geolyzer
* Inventory Upgrade
* Inventory Controller
* Crafting Upgrade

(If you decide to use Creatix, you'll have to give it a Geolyzer.)

Once your robot is running and OpenOS is installed, just run this command:

```
pastebin stillneedtodothis
```

After answering a few questions about your robot, it will connect to the server you started in the previous step. Congratulations, you're done! Check out [this guide](guide.md) for some helpful tips about using the Roboserver.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

This project is made possible by the continued effort of all the wonderful people who contribute to [OpenComputers](https://github.com/MightyPirates/OpenComputers).