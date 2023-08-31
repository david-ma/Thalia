// Calling this file helpers.ts because util is reserved

const fs = require('fs');

export function hello() {
  console.log("hello world");
}

export function checkPackage() {
  fs.readFile('package.json', 'utf8', function (err: any, data: any) {
    console.log(data)
  });
}

export default { hello, checkPackage }
