import { LlmService } from './server/services/llm_service.ts';

const testCases = [
  '  Name = Test Value',
  'FileName = ABC123',
  '[Section]',
  '; comment',
  'Key=NoSpaces',
  '  IndentedKey = Value With Spaces',
];

testCases.forEach(line => {
  const result = LlmService.normalizeIniAssignmentLine(line);
  console.log(`Input:  '${line}'`);
  console.log(`Output: '${result}'`);
  console.log('---');
});

// Test cleanIniFormat
const multiline = `[Configuration]
Name = Order Response validation
FileName = validation.RSP.DC.DENTAL-US.xml

[Section2]
Key = value with spaces`;

console.log('=== cleanIniFormat Test ===');
console.log('Input:');
console.log(multiline);
console.log('\nOutput:');
console.log(LlmService.cleanIniFormat(multiline));
