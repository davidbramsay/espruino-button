const THRESH=1; //up to 127, how much acceleration to trigger on
const COUNT=0; //up to 127, how many samples in a row must be > Thresh to trigger.  Decrement if sample is not above thresh.


//Test LEDs
D3.write(1);
setTimeout(function(){D3.write(0);D4.write(1);}, 1000);
setTimeout(function(){D4.write(0);D5.write(1);}, 2000);
setTimeout(function(){D5.write(0);}, 3000);


//Button/Shake-Switch Callback
pinMode(D0, 'input_pulldown');
pinMode(D1, 'input_pulldown');

setWatch(function(e) {
  console.log('0');
  D4.write(1);
  setTimeout(function(){D4.write(0);}, 3000);
}, D0, { repeat: true, edge: 'rising', debounce: 50 });




//I2C

//address with SA0 grounded, otherwise 0x1D
const MMA8452_ADDRESS = 0x1C;

const MMA_INT1 = D16;
const MMA_INT2 = D17;

//---------- MMA8452 REGISTERS ----------

//control registers
const CTRL_REG1 = 0x2A;
const CTRL_REG2 = 0x2B;
const CTRL_REG3 = 0x2C;
const CTRL_REG4 = 0x2D;
const CTRL_REG5 = 0x2F;
const XYZ_DATA_CFG = 0x0E;
const HP_FILTER_CUTOFF = 0x0F;
const ASLP_COUNT = 0x29;

//orientation detector registers (portrait/landscape)
const PL_CFG = 0x11;
const PL_STATUS = 0x10; //read-only
const PL_COUNT = 0x12; //read-only

//free fall detector registers
const FF_MT_CFG = 0x15;
const FF_MT_THS = 0x17; //threshold
const FF_MT_COUNT = 0x18;
const FF_MT_SRC = 0x16; //read-only

//transient detector registers
const TRANSIENT_CFG = 0x1D;
const TRANSIENT_THS = 0x1F; //threshold
const TRANSIENT_COUNT = 0x20;
const TRANSIENT_SRC = 0x1E; //read-only

//pulse detector registers
const PULSE_CFG = 0x21;
const PULSE_THSX = 0x23; //threshold
const PULSE_THSY = 0x24; //threshold
const PULSE_THSZ = 0x25; //threshold
const PULSE_TMLT = 0x26; //time-limit
const PULSE_LTCY = 0x27; //latency for double pulse
const PULSE_WIND = 0x28; //window for double pulse
const PULSE_SRC = 0x22; //read-only

//debug/status registers
const WHO_AM_I  = 0x0D;  //read-only, reports 0x2A (42), test
const SYSMOD    = 0x0B; //read-only
const INT_SOURCE = 0x0C; //read-only

//calibration registers
const OFF_X = 0x2F;
const OFF_Y = 0x30;
const OFF_Z = 0x31;

//---------- MMA8452 REGISTERS ----------

function write_MMA(reg, val){
  I2C1.writeTo(MMA8452_ADDRESS, reg, val);
}

function read_MMA(reg){
  I2C1.writeTo({address:MMA8452_ADDRESS, stop:false}, reg);
  return I2C1.readFrom(MMA8452_ADDRESS, 1);
}

function MMA8452_setStandby(){
  var c = read_MMA(CTRL_REG1);
  write_MMA(CTRL_REG1, c & ~(0x01));
}

function MMA8452_setActive(){
  var c = read_MMA(CTRL_REG1);
  write_MMA(CTRL_REG1, c | 0x01);
}

function MMA8452_powerOff() {
  D18.write(0); //power off
}

function MMA8452_powerOn(ff_thresh, //up to 127
                         ff_num_above_thresh_to_trigger, //up to 127
                         int_cb) {

  pinMode(MMA_INT1, 'input_pulldown');
  pinMode(MMA_INT2, 'input_pulldown');

  D18.write(1); //power on
  I2C1.setup({ scl: D19, sda: D20 }); //setup

  var resp = read_MMA(WHO_AM_I);
  if (resp == 0x2A){

    //going to set up     //slow sampling asleep/awake, low res data, standby.
    write_MMA(CTRL_REG1, 0xFA);
    //low power sample (can also do low-noise low-power), autosleep
    write_MMA(CTRL_REG2, 0x1F);
    //transient int, freefall int set, push-pull interrupt high mode
    write_MMA(CTRL_REG3, 0x4A);
    //just transient int enabled
    write_MMA(CTRL_REG4, 0x20);
    //interrupt routing. all to int 2, this register doesn't seem to work
    write_MMA(CTRL_REG5, 0x00);
    //range to 2g, HPF the *DATA* is off
    write_MMA(XYZ_DATA_CFG, 0x00);
    //set HPF for transient detection.  Highest cutoff, for
    //1HZ=0.25Hz, this goes up with sampling freq/powermode
    write_MMA(HP_FILTER_CUTOFF, 0x30);
    //min period to autosleep
    write_MMA(ASLP_COUNT, 0x00);

    write_MMA(TRANSIENT_CFG, 0x0E);
    write_MMA(TRANSIENT_THS, ff_thresh); 
    write_MMA(TRANSIENT_COUNT, ff_num_above_thresh_to_trigger);


    setWatch(function(e) {
      int_cb();
      read_MMA(TRANSIENT_SRC); //clear interrupt
    }, MMA_INT2, { repeat: true, edge: 'rising'});

    MMA8452_setActive();

    //read_MMA(FF_MT_SRC);//clear interrupt
    read_MMA(TRANSIENT_SRC); //clear interrupt

  } else {
   console.log('FAILED TO CONNECT TO MMA8452');
   MMA8452_powerOff();
  }
}

function int_cb(){
  console.log("2");
}

MMA8452_powerOn(THRESH, COUNT, int_cb);
