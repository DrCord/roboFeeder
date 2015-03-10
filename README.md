# roboFeeder
##nodejs code to run RFID pet feeder using a Raspberry Pi

[github repository](https://github.com/DrCord/roboFeeder)
[project website](http://robofeeder.cordslatton.com)

Dependencies:
* NodeJS
* nodejs package rpi-gpio https://www.npmjs.com/package/rpi-gpio
* nodejs package async https://github.com/caolan/async

Parts List:
* Raspberry Pi ([A+](http://www.adafruit.com/products/2266), [B+](http://www.adafruit.com/products/1914), [Pi 2](http://www.adafruit.com/products/2358))
* Micro SD card (4GB+) compatible with Raspberry Pi with Raspbian installed ([Adafruit](https://www.adafruit.com/products/1562))
* Wireless network dongle compatible with Raspberry Pi with a decent antenna ([Adafruit](http://www.adafruit.com/products/1012))
(if using the Raspberry Pi A+ you will need either a [serial to usb cable](http://www.adafruit.com/products/954) or a HDMI monitor/tv and keyboard to program the Raspberry pi with the Wifi connection details.)
* PIR Sensor ([SparkFun](https://www.sparkfun.com/products/8630))
* RFID Sensor with serial output (9600 bps to use codebase without changing) ([AliExpress](http://www.aliexpress.com/store/product/Free-Shipping-RFID-module-HZ-1050-Kits-125KHZ-Serial-port-UART-output-for-arduino-uno-2560/1026060_1780057192.html))
* Logic Level Converter 5v - 3.3V (bi-directional) ([SparkFun](https://www.sparkfun.com/products/12009))
* L293D Chip - Dual H-Bridge Motor Driver ([Adafruit](https://www.adafruit.com/products/807))
* AdaFruit Half-size Perma-proto Raspberry Pi ([Adafruit](http://www.adafruit.com/products/1148))
* Downgrade GPIO Ribbon Cable for Pi A+/B+/Pi 2 - 40p to 26p ([Adafruit](https://www.adafruit.com/products/1986))
* Resistors (220, 1K, 10K, Other) //TODO: Note other resistor resistance
* Wire (ideally of various colors) //TODO: estimate total length and optimal number of colors
* Momentary Push Button Switch x2 ([Adafruit](https://www.adafruit.com/products/1119))
* CD/DVD-ROM Drive (Up-cycled - as long as the drive tray and motor work, the older the better, older drives are more robust)
* Hinge (1-2 inch) //TODO: measure
* Hook and Eye Latch //TODO: measure
* Small self tapping screws //TODO: Measure size and count quantity
* 3/4 inch wood //TODO - get minimum measurements of piece that all pieces can be cut from
* 5.5v - 23v output Standard AC to DC wall plug (ideally recycle an unused one from something else or get one from your local reuse store)
* Compatible input power jack //TODO get jack name and specifications
* Hobbywing 5V/6V 3 Amp Switch-Mode Ultimate BEC ([DealExtreme](http://www.dx.com/p/hobbywing-5v-6v-3a-switch-mode-ultimate-bec-ubec-15149))
* Small perf-board ([Adafruit](https://www.adafruit.com/products/1608))

License

Software, parts list and CAD files to build and run a RFID controlled Raspberry Pi pet feeder
Copyright (C) 2015  Cord Slatton-Valle 
cord42@gmail.com
(cordslatton.com)[http://www.cordslatton.com]

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
