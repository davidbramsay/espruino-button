# espruino-button

must run on linux with bluepy
`sudo python bluepy_uart.py e3:0a:06:6f:37:7d basic_shake_accel.js`


espruino --list to get address, may have to try a couple of times

web ide connects automatically well, can see the last 4 digits of the MAC.  Can code and test, then download.

to send code over, just do:
espruino -p MAC_ADDRESS program_to_send.js

minify first, then send when really done:
espruino --board MDBT42Q --minify program_to_send.js -o mini_program_to_send.js
espruino -p MAC_ADDRESS mini_program_to_send.js

