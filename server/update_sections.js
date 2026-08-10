const { connect, mongoose } = require('./src/db'); 
const Setting = require('./src/models/Setting'); 
connect().then(async () => { 
  const sec = (n) => Array.from({ length: n }, (_, i) => String(i + 1)); 
  const DEFAULT_SECTIONS = { 
    I: sec(19), 
    II: sec(22), 
    III: sec(19), 
    IV: [...sec(19), ...Array.from({ length: 9 }, (_, i) => String(51 + i))] 
  }; 
  await Setting.findOneAndUpdate({ key: 'sections_config' }, { $set: { value: JSON.stringify(DEFAULT_SECTIONS) } }); 
  console.log('Updated sections_config in DB'); 
  process.exit(0); 
}).catch(console.error);