# USAGE:
# python bluepy_uart.py ff:a0:c7:07:8c:29 command_file.js

import sys
from bluepy import btle
from time import sleep


if len(sys.argv) != 3:
  print "Fatal, must pass command file (js) and device address:", sys.argv[0], "<device address="">"
  quit()


# \x03 -> Ctrl-C clears line
# \x10 -> Echo off for line so don't try and send any text back
#command = "\x03\x10reset()\nLED.toggle()\n"
#command = "\x03\x10clearInterval()\n\x10setInterval(function() {LED.toggle()}, 500);\n\x10print('Hello World')\n"


def read_js_to_send(js_filename):
  #convert js file to command string to send
  out_command = '\x03'
  lines = open(js_filename, 'r').readlines()
  for line in lines:
    out_command += '\x10' + line

  print(out_command)
  return out_command

command = read_js_to_send(sys.argv[2])


# Handle received data
class NUSRXDelegate(btle.DefaultDelegate):
    def __init__(self):
        btle.DefaultDelegate.__init__(self)
        # ... initialise here
    def handleNotification(self, cHandle, data):
        print('RX: ', data)
# Connect, set up notifications
p = btle.Peripheral(sys.argv[1], "random")
p.setDelegate( NUSRXDelegate() )
nus = p.getServiceByUUID(btle.UUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E"))
nustx = nus.getCharacteristics(btle.UUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E"))[0]
nusrx = nus.getCharacteristics(btle.UUID("6E400003-B5A3-F393-E0A9-E50E24DCCA9E"))[0]
nusrxnotifyhandle = nusrx.getHandle() + 1
p.writeCharacteristic(nusrxnotifyhandle, b"\x01\x00", withResponse=True)
# Send data (chunked to 20 bytes)
while len(command)>0:
  nustx.write(command[0:20]);
  command = command[20:];
# wait for data to be received
while True:
    p.waitForNotifications(30.0)
    print ('loop')
p.disconnect()
