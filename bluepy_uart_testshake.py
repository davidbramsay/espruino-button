import sys
import atexit
import time
import threading
from bluepy import btle



# Handler received data
class NUSRXDelegate(btle.DefaultDelegate):
    def __init__(self, callback):
        btle.DefaultDelegate.__init__(self)
        self.callback = callback

    def handleNotification(self, cHandle, data):
        self.callback(data)


class EspruinoConnectorThread(threading.Thread):
    def __init__(self,
                 callback,
                 filename = 'basic_esp_code.js',
                 mac='e3:0a:06:6f:37:7d'):
        threading.Thread.__init__(self)
        self.daemon = True
        self.callback = callback
        self.filename = filename
        self.mac = mac

    def run(self):
        print 'starting Espruino thread'
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
            print('esp thread')
            self.wait_sec(60)

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
        print 'espruino thread closed'
        self.p.disconnect()

if __name__=='__main__':

    def callback(data):
        if '1' in data or '0' in data:
            print 'button'
        if '2' in data:
            print 'accel'


    E = EspruinoConnectorThread(callback)
    E.start()
    while True:
        print('main thread')
        time.sleep(30)
    print 'Done'
