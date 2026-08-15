const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/sample-excel',
  method: 'POST'
}, res => {
  res.on('data', d => process.stdout.write(d));
  res.on('end', () => {
    console.log('\n--- sample loaded ---');
    
    const chatReq = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, res2 => {
      let body = '';
      res2.on('data', d => body += d);
      res2.on('end', () => {
        console.log('\n--- chat response ---');
        console.log(JSON.stringify(JSON.parse(body), null, 2));
      });
    });
    
    chatReq.write(JSON.stringify({ message: 'Generate for Partner A 850' }));
    chatReq.end();
  });
});

req.end();
