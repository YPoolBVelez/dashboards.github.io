const fs = require('fs');
const s = fs.readFileSync('src/app-standalone.js','utf8');
const stack = [];
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (ch === '(') stack.push(i);
  else if (ch === ')') {
    if (stack.length === 0) {
      console.log('Unbalanced closing ) at', i);
      process.exit(0);
    }
    stack.pop();
  }
}
if (stack.length > 0) {
  const pos = stack[stack.length - 1];
  const before = s.slice(Math.max(0, pos - 80), pos + 80);
  const linesUpToPos = s.slice(0, pos).split(/\r?\n/);
  console.log('Unmatched ( at index', pos, 'line', linesUpToPos.length);
  console.log('Context around it:\n', before);
} else {
  console.log('No unmatched (');
}
