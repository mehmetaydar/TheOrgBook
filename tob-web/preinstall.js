/**
 * Before building, files must be copied or symlinked into src/themes/_active
 * The default theme (src/themes/default) is always copied first, and then another
 * theme named by the TOB_THEME environment variable can add to or replace these files.
 **/

var fs = require('fs'),
    path = require('path');

THEME_NAME = process.env.TOB_THEME || 'bcgov';
if (THEME_NAME === '_active')
    throw 'Invalid theme name';
TARGET_DIR = 'src/themes/_active';
THEMES_ROOT = 'src/themes';
LANG_ROOT = 'assets/i18n';
RESOLVE_LINKS = ['favicon.ico', 'styles.scss', LANG_ROOT];


if(! fs.copyFileSync) {
    // add stub for node.js versions before 8.5.0
    // NB: flags not implemented
    fs.copyFileSync = function(source, target, flags) {
        return fs.writeFileSync(target, fs.readFileSync(source));
    }
}

function unlinkRecursiveSync(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(function(file, index) {
            var target_path = path.join(dir, file);
            if (fs.lstatSync(target_path).isDirectory()) {
                unlinkRecursiveSync(target_path);
            } else {
                fs.unlinkSync(target_path);
            }
        });
        fs.rmdirSync(dir);
    }
}

function populateLinksSync(source_dir, target_dir) {
    fs.readdirSync(source_dir).forEach(function(file, index) {
        var source_path = path.join(source_dir, file);
        var target_path = path.join(target_dir, file);
        var source_stats = fs.lstatSync(source_path);
        var target_stats = null;
        try {
            target_stats = fs.lstatSync(target_path);
        } catch (err) { }
        if (target_stats && target_stats.isSymbolicLink()) {
            var sync_target_stats = fs.statSync(target_path);
            var resolved_source_path = fs.realpathSync(target_path);
            fs.unlinkSync(target_path);
            if (sync_target_stats.isDirectory()) {
                fs.mkdirSync(target_path);
                populateLinksSync(resolved_source_path, target_path);
                target_stats = fs.lstatSync(target_path);
            } else {
                target_stats = null;
            }
        }
        if (target_stats) {
            if (target_stats.isDirectory() && source_stats.isDirectory()) {
                populateLinksSync(source_path, target_path);
                return;
            } else if (target_stats.isDirectory()) {
                unlinkRecursiveSync(target_path);
            } else {
                fs.unlinkSync(target_path);
            }
        }
        // must change to the target directory to create the relative symlink properly
        link_path = path.relative(target_dir, source_path);
        return_dir = path.relative(target_dir, process.cwd());
        process.chdir(target_dir);
        fs.symlinkSync(link_path, file);
        process.chdir(return_dir);
    });
}

function copyThemeDir(theme_name, target_dir) {
    var theme_dir = path.join(THEMES_ROOT, theme_name)
    try {
        fs.accessSync(theme_dir, fs.constants.R_OK);
    } catch (err) {
        throw 'Theme directory not found or not readable: ' + theme_dir
    }
    if (! fs.statSync(theme_dir).isDirectory()) {
        throw 'Theme path is not a directory: ' + theme_dir
    }
    populateLinksSync(theme_dir, target_dir);
}

function cleanTargetDir(target_dir, root, depth) {
    if (!depth) depth = 0;
    try {
        fs.mkdirSync(target_dir);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    fs.readdirSync(target_dir).forEach(function(file, index) {
        var target_path = path.join(root || '.', target_dir, file);
        var stat = fs.lstatSync(target_path);
        if (stat.isDirectory()) {
            cleanTargetDir(target_path, root, depth+1);
            fs.rmdirSync(target_path);
        } else if(stat.isSymbolicLink()) {
            fs.unlinkSync(target_path);
        } else {
            var del = false;
            if (!depth && ~RESOLVE_LINKS.indexOf(file)) {
                del = true;
            } else {
                var lang_path = path.join(TARGET_DIR, LANG_ROOT);
                if (target_path.startsWith(lang_path) && target_path.endsWith('.json')) {
                    del = true;
                }
            }
            if (del) {
                fs.unlinkSync(target_path);
            } else {
                throw 'Non-symlinked file found in deployment directory, ' +
                    'please move to themes directory or remove: ' + target_path;
            }
        }
    });
}

function resolveLinks(target_dir, paths) {
    // replace particular files that need to be copied, not symlinked
    if (!paths) return;
    for (var file of paths) {
        var target_path = path.join(target_dir, file);
        try {
            target_stats = fs.lstatSync(target_path);
        } catch (err) {
            continue;
        }
        if (target_stats.isSymbolicLink()) {
            real_path = fs.realpathSync(target_path);
            fs.unlinkSync(target_path);
            try {
                real_stats = fs.lstatSync(real_path);
            } catch (err) {
                continue;
            }
            if(real_stats.isDirectory())
                fs.mkdirSync(target_path);
            else
                fs.copyFileSync(real_path, target_path);
        }
    }
}

function findLanguages(target_dir) {
    var ret = [];
    var lang_path = path.join(target_dir, LANG_ROOT);
    if (fs.existsSync(lang_path)) {
      fs.readdirSync(lang_path).forEach(function(file, index) {
          if(file.endsWith('.json')) {
              ret.push(file.substring(0, file.length - 5));
          }
      });
    }
    return ret;
}

function resolveLangPaths(theme_name, language) {
    var ret = [];
    var lang_path = path.join(THEMES_ROOT, theme_name, LANG_ROOT, language + '.json');
    if (fs.existsSync(lang_path)) {
        ret.push(lang_path);
    }
    if (theme_name !== 'default') {
        var def_path = path.join(THEMES_ROOT, 'default', LANG_ROOT, language + '.json');
        if (fs.existsSync(def_path)) {
            ret.push(def_path);
        }
    }
    if (language !== 'en') {
        ret = ret.concat(resolveLangPaths(theme_name, 'en'));
    }
    return ret;
}

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    if (typeof(target) === 'object' && typeof(source) === 'object') {
        for (const key in source) {
            if (typeof(source[key]) === 'object') {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return mergeDeep(target, ...sources);
}

function combineLanguage(theme_name, target_dir) {
    var langs = findLanguages(path.join(THEMES_ROOT, theme_name));
    if (theme_name !== 'default')
        langs = langs.concat(findLanguages(path.join(THEMES_ROOT, 'default')));
    var lang_dir = path.join(target_dir, LANG_ROOT);
    for (var lang of new Set(langs)) {
        var paths = resolveLangPaths(theme_name, lang);
        if (paths.length) {
            paths.reverse();
            var input = [];
            for (var lang_path of paths) {
                input.push(require('./' + lang_path));
            }
            var data = mergeDeep(...input);
            var target_path = path.join(lang_dir, lang + '.json');
            try {
                target_stats = fs.lstatSync(target_path);
            } catch (err) {
                target_stats = null;
            }
            if (target_stats && target_stats.isSymbolicLink()) {
                fs.unlinkSync(target_path);
            }
            fs.writeFileSync(target_path, JSON.stringify(data));
        }
    }
}

console.log('Copying theme files to ' + TARGET_DIR);
console.log('Theme selected: ' + THEME_NAME);

cleanTargetDir(TARGET_DIR);

copyThemeDir('default', TARGET_DIR)
if (THEME_NAME !== 'default') {
    copyThemeDir(THEME_NAME, TARGET_DIR)
}

resolveLinks(TARGET_DIR, RESOLVE_LINKS);
combineLanguage(THEME_NAME, TARGET_DIR);

console.log('Done.\n');
