const prefixRegexPart = "(JX|JZ|JY)";
const regex = new RegExp(`^${prefixRegexPart}\\d{10,12}$`);
console.log(regex.test("JY1234567890"));
