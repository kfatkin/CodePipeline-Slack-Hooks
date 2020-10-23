export class Strings {
  static base64Decode(encoded: string) {
    const buffer = Buffer.from(encoded, 'base64');
    return buffer.toString('ascii');
  }

  static base64Encode(text: string) {
    const buffer = Buffer.from(text, 'ascii');
    return buffer.toString('base64');
  }

  static ucFirst(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  static toCamel(text: string) {
    return text.replace(/[-_]([a-z])/g, item => {
      return item[1].toUpperCase();
    });
  }
}
