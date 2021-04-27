import sys
import atexit
import time
import threading
from bluepy import btle
import logging, threading, functools
import time
import requests
import os

logging.basicConfig(level=logging.NOTSET,
                    format='%(threadName)s %(message)s')

global gGuitarPlaying
global gTimer

class Timer(object):
    def __init__(self, interval, callback):
        self.interval = interval
        self.callback = callback

    def start(self):
        self.thread = threading.Timer(self.interval, self.callback)
        self.thread.start()

    def cancel(self):
        self.thread.cancel()

    def restart(self):
        self.thread.cancel()
        self.thread = threading.Timer(self.interval, self.callback)
        self.thread.start()


# Handler received data
class NUSRXDelegate(btle.DefaultDelegate):
    def __init__(self, callback):
        btle.DefaultDelegate.__init__(self)
        self.callback = callback

    def handleNotification(self, cHandle, data):
        self.callback(data)


class EspruinoConnector():
    def __init__(self,
                 callback,
                 filename = '/home/pi/Documents/espruino-button/basic_esp_code.js',
                 mac='e3:0a:06:6f:37:7d'):
        self.callback = callback
        self.filename = filename
        self.mac = mac

    def run_forever(self):
        print 'starting Espruino'
        # Connect, set up notifications
        atexit.register(self.close)
        self.p = btle.Peripheral(self.mac, "random")
        self.p.setDelegate( NUSRXDelegate(self.callback))

        nus = self.p.getServiceByUUID(btle.UUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E"))
        nustx = nus.getCharacteristics(btle.UUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E"))[0]
        nusrx = nus.getCharacteristics(btle.UUID("6E400003-B5A3-F393-E0A9-E50E24DCCA9E"))[0]
        nusrxnotifyhandle = nusrx.getHandle() + 1

        self.p.writeCharacteristic(nusrxnotifyhandle, b"\x01\x00", withResponse=True)
        command = self.read_js_to_send(self.filename)
        while len(command)>0:
            nustx.write(command[0:20])
            command = command[20:]

        while True:
            self.wait_sec(120)

    def read_js_to_send(self, js_filename):
        #convert js file to command string to send
        out_command = '\x03'
        lines = open(js_filename, 'r').readlines()
        for line in lines:
            out_command += '\x10' + line
        return out_command

    def wait_sec(self, sec):
        self.p.waitForNotifications(sec)

    def close(self):
        print 'espruino closed'
        self.p.disconnect()

if __name__=='__main__':

    time.sleep(60)

    def guitarTimeoutCallback():
        global gGuitarPlaying
        requests.get('http://pihub.local:5000/fadeout')
        requests.get('http://pihub.local:5000/play/fireplace')
        requests.get('http://pihub.local:5000/outlets/on')
        time.sleep(5)
        requests.get('http://pihub.local:5000/setlight/0/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/1/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/2/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/3/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/4/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/5/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/6/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/setlight/7/color/yellow/dim/15')
        requests.get('http://pihub.local:5000/outlets/on')
        time.sleep(1)
        gGuitarPlaying = False

    gGuitarPlaying = False
    gTimer = Timer(30, guitarTimeoutCallback)

    def motionCallback(data):
        global gGuitarPlaying
        global gTimer

        if '1' in data or '0' in data:
            print 'button'
        if '2' in data:
            print 'accel'
            if not gGuitarPlaying:
                gGuitarPlaying = True
                requests.get('http://pihub.local:5000/outlets/off')
                requests.get('http://pihub.local:5000/lightoff')
                time.sleep(1)
                requests.get('http://pihub.local:5000/setlight/0/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/1/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/2/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/3/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/4/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/5/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/6/color/blue/dim/10')
                requests.get('http://pihub.local:5000/setlight/7/color/blue/dim/10')
                requests.get('http://pihub.local:5000/fadein')
                requests.get('http://pihub.local:5000/outlets/off')
                time.sleep(5)
                requests.get('http://pihub.local:5000/play/jellyfish')
                gTimer.start()
            else:
                gTimer.restart()

    #this is to work with monit
    pid = str(os.getpid())
    with open('/tmp/buttonserver.pid','w') as file:
        file.write(pid)

    E = EspruinoConnector(motionCallback)
    E.run_forever()
    print 'Done'
