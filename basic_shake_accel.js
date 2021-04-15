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
  console.log("Button Press");
}, D0, { repeat: true, edge: 'rising', debounce: 50 });

setWatch(function(e) {
  console.log("Shake");
}, D1, { repeat: true, edge: 'falling'});



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

function check_MMA_status(){
  var c = read_MMA(INT_SOURCE);
  console.log('INT_SRC REG = ' + c + ', STATE = ' + check_MMA_state());
  //var c = read_MMA(CTRL_REG5);
  //console.log('CTRL_REG5 = ' + c);
}
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

function check_MMA_state(){
 //check system mode, 0=Standby, 1=Wake, 2=Sleep
 var c = read_MMA(SYSMOD);
 switch (c[0]){
   case 0:
     return 'Standby';
   case 1:
     return 'Wake';
   case 2:
     return 'Sleep';
 }
}

function MMA8452_powerOn(ff_thresh, //up to 127
                         ff_num_above_thresh_to_trigger, //up to 127
                         int1_cb,
                         int2_cb) {

  pinMode(MMA_INT1, 'input_pulldown');
  pinMode(MMA_INT2, 'input_pulldown');

  D18.write(1); //power on
  I2C1.setup({ scl: D19, sda: D20 }); //setup

  var resp = read_MMA(WHO_AM_I);
  if (resp == 0x2A){
    console.log('Connected to MMA8452...');

    //going to set up low-res, low power, motion detection (FF) and
    //transient detection (FF+HPF). 2g for sensitivity.

    //can put in different range (2g, 4g, 8g - XYZ_DATA_CFG)
    //can enable different axes to care (FF_MT_CFG)
    //can change sample rate, which changes hp (CTRL_REG1)
    //can change data res, which changes HPF, or HPF for transient

    console.log('setting control registers...');

    //slow sampling asleep/awake, low res data, standby.
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

    console.log('setting interrupt behavior...');
    
    /* not using motion, more sensitive if HPF 1g with transient detector
    //Freefall setup - ELE=1, OAE=1 (OR axes), XYZ all on
    write_MMA(FF_MT_CFG, 0xF8);
    //debounce logic=0, threshold for free-fall on axis
    write_MMA(FF_MT_THS, ff_thresh);
    //count of threshold events in a row before interrupt
    write_MMA(FF_MT_COUNT, ff_num_above_thresh_to_trigger);
    */
    
    //Transient setup - enable on all axes, HPF on
    write_MMA(TRANSIENT_CFG, 0x0E);
    //threshold for transient,similar to FF
    write_MMA(TRANSIENT_THS, ff_thresh); 
    //count to generate interrupt, similar to FF
    write_MMA(TRANSIENT_COUNT, ff_num_above_thresh_to_trigger);

    /* not using motion, more sensitive if HPF 1g with transient detector
    setWatch(function(e) {
      int1_cb();
      read_MMA(FF_MT_SRC);//clear interrupt
    }, MMA_INT1, { repeat: true, edge: 'rising'});
    */

    setWatch(function(e) {
      int2_cb();
      read_MMA(TRANSIENT_SRC); //clear interrupt
    }, MMA_INT2, { repeat: true, edge: 'rising'});

    MMA8452_setActive();
    console.log('MMA8452 Active!');
    console.log(check_MMA_state());

    //read_MMA(FF_MT_SRC);//clear interrupt
    read_MMA(TRANSIENT_SRC); //clear interrupt

  } else {
   console.log('FAILED TO CONNECT TO MMA8452');
   console.log('Should get 0x2A(42), got ' + resp);
   MMA8452_powerOff();
  }
}


function int1_cb(){
  console.log("MMA- FF Interrupt");
  check_MMA_status();
}

function int2_cb(){
  console.log("MMA- Transient Interrupt");
}

MMA8452_powerOn(THRESH, COUNT, int1_cb, int2_cb);

/*
setInterval(function(){
  check_MMA_status();
}, 3000);
*/