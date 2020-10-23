import * as fs from 'fs';
import * as path from 'path';

export class FilesLib {
  static getHomeDir() {
    return require('os').homedir();
  }

  static readFile(filePath: string) {
    const data = fs.readFileSync(filePath);
    return data.toString();
  }

  static writeFile(filePath: string, data: any) {
    return fs.writeFileSync(filePath, data);
  }

  static fileExists(file: string) {
    if (fs.existsSync(file)) {
      return true;
    }
    return false;
  }

  static copy(srcFile: string, desFile: string) {
    fs.copyFileSync(srcFile, desFile);
  }

  static makeDir(targetDir: string, { isRelativeToScript = false } = {}) {
    const path = require('path');
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
      const curDir = path.resolve(baseDir, parentDir, childDir);
      try {
        fs.mkdirSync(curDir);
      } catch (err) {
        if (err.code === 'EEXIST') {
          // curDir already exists!
          return curDir;
        }

        // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
        if (err.code === 'ENOENT') {
          // Throw the original parentDir error on curDir `ENOENT` failure.
          throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
        }

        const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
        if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
          throw err; // Throw if it's just the last created dir.
        }
      }

      return curDir;
    }, initDir);
  }

  static listFiles(dir, fileList) {
    fileList = fileList || [];
    fs.readdirSync(dir).forEach(file => {
      fileList = fs.statSync(path.join(dir, file)).isDirectory()
        ? FilesLib.listFiles(path.join(dir, file), fileList)
        : fileList.concat(path.join(dir, file));
    });
    return fileList;
  }
}
