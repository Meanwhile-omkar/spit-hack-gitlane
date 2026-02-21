/**
 * react-native-fs → isomorphic-git fs interface adapter.
 * isomorphic-git needs a node-like `fs` object with these methods.
 * IMPORTANT: all "not found" errors must have code='ENOENT' so
 * isomorphic-git knows to treat them as missing-file, not fatal errors.
 */
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';

/** Wrap any RNFS error into a proper ENOENT for isomorphic-git */
function enoent(path) {
  const err = new Error(`ENOENT: no such file or directory, '${path}'`);
  err.code = 'ENOENT';
  return err;
}

const fs = {
  promises: {
    readFile: async (path, options) => {
      const encoding = options === 'utf8' || options?.encoding === 'utf8' ? 'utf8' : 'base64';
      try {
        const data = await RNFS.readFile(path, encoding);
        if (encoding === 'base64') {
          return Buffer.from(data, 'base64');
        }
        return data;
      } catch (e) {
        throw enoent(path);
      }
    },

    writeFile: async (path, data, _options) => {
      if (typeof data === 'string') {
        await RNFS.writeFile(path, data, 'utf8');
      } else {
        const base64 = Buffer.from(data).toString('base64');
        await RNFS.writeFile(path, base64, 'base64');
      }
    },

    unlink: async path => {
      try {
        await RNFS.unlink(path);
      } catch (e) {
        throw enoent(path);
      }
    },

    readdir: async path => {
      try {
        const items = await RNFS.readDir(path);
        return items.map(i => i.name);
      } catch (e) {
        throw enoent(path);
      }
    },

    mkdir: async (path, _options) => {
      try {
        await RNFS.mkdir(path);
      } catch (e) {
        // ignore "already exists" errors
        if (!e.message?.includes('exists')) throw e;
      }
    },

    rmdir: async path => {
      try {
        await RNFS.unlink(path);
      } catch (e) {
        throw enoent(path);
      }
    },

    stat: async path => {
      try {
        const s = await RNFS.stat(path);
        return {
          isFile: () => s.isFile(),
          isDirectory: () => s.isDirectory(),
          isSymbolicLink: () => false,
          size: Number(s.size),
          mtimeMs: new Date(s.mtime).getTime(),
          ctimeMs: new Date(s.ctime ?? s.mtime).getTime(),
          mode: s.isDirectory() ? 0o040755 : 0o100644,
          ino: 0,
        };
      } catch (e) {
        throw enoent(path);
      }
    },

    lstat: async path => {
      return fs.promises.stat(path);
    },

    readlink: async _path => {
      throw enoent(_path);
    },

    symlink: async (_target, _path) => {
      // no-op — symlinks not supported on Android
    },

    chmod: async (_path, _mode) => {
      // no-op on Android
    },
  },
};

export default fs;
