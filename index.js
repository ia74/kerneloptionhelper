const pauseReadFromStdin = (question) => {
	return new Promise((resolve, reject) => {
		const stdin = process.stdin;
		const stdout = process.stdout;

		stdin.resume();
		stdout.write(question);

		stdin.once('data', (data) => {
			resolve(data.toString().trim());
			stdin.pause();
		});
	});
}

const fs = require('fs');

const main = async () => {

	const fn = process.argv[2] || await pauseReadFromStdin('[KOH] Enter the file name: ');

	if(!fs.existsSync(fn)) {
		console.log(`[KOH] File ${fn} not found!`);
		return;
	}
	handleFile(fn);
}

const handleFile = (fn) => {
	const data = fs.readFileSync(fn, 'utf8');
	const lines = data.split('\n');
	let currentSection = '';
	let variables = {};
	let opts = {};
	let special = {};
	let finished = '';
	lines.forEach((line) => {
		line = line.split('#')[0].trim();
		if(line.startsWith('$')) {
			const parts = line.split('=');
			if(parts.length === 2) {
				const key = parts[0].trim();
				const value = parts[1].trim();
				variables[key] = value;
			}
			return;
		} else if(line.includes('$')) {
			Object.keys(variables).forEach((key) => {
				if(line.includes(key)) {
					line = line.replace(key, variables[key]);
				}
			});
		}
		if(line.endsWith('{') && currentSection != '') {
			currentSection += '.' + line.split('{')[0].trim();
		}
		if(line.endsWith('}') && currentSection != '') {
			currentSection = currentSection.substring(0, currentSection.lastIndexOf('.'));
		}
		if(line.endsWith(',')) {
			line = line.substring(0, line.length - 1);
		}
		if(line.endsWith('{') && currentSection == '') {
			currentSection = line.split('{')[0].trim();
		} else {
			if(line.trim() !== '') {
				const parts = line.split('=');
				if(!line.includes('=')) {
					if(currentSection.startsWith('@')) {
						const k = line.trim();
						if(!special['root']) {
							special['root'] = [];
						}
						special['root'].push(k)
					}
				}
				
				if(parts.length === 2) {
					const key = parts[0].trim();
					const value = parts[1].trim();
					if(currentSection.startsWith('@') && currentSection != '@root') {
						const k = key;
						if(!special[currentSection]) {
							special[currentSection] = {};
						}
						special[currentSection][k] = value;
						return;
					}

					if(currentSection == '') {
						opts[key] = value;
					} else {
						if(!opts[currentSection]) {
							opts[currentSection] = {};
						}
						opts[currentSection][key] = value;
					}
				}
			}
		}
	})
	Object.keys(opts).forEach((key) => {
		Object.keys(opts[key]).forEach((k) => {
			let fmt = `${key}.${k}=`;
			if(key == '@root') fmt = `${k}=`;
			if(k == 'use') fmt = ``;
			if(k == '_use') fmt = `use=`;
			finished += `${fmt}${opts[key][k]} `;
		});
	});
	Object.keys(special).forEach((key) => {
		Object.keys(special[key]).forEach((k) => {
			if(key == '@logging') {
				let fmt = `${k}=`;
				if(k == 'level') fmt = 'loglevel='; // Hacky but it works i think.
				if(k == 'use') fmt = ``;
				if(k == '_use') fmt = `use=`;
				finished += `${fmt}${special[key][k]} `;
			}
		});
	});
	if(special['@settings']['options_file']) {
		let files = special['@settings']['options_file'].split(';');
		files.forEach((file) => {
			fs.writeFileSync(file, finished);
		});
	}

	// efibootmgr -c -d (disk) -p (partition) -L (label) -l (loader) -u "(finished)"

	// first we remove boot 00000

	const child = require('child_process');
	pauseReadFromStdin('[KOH] Press enter to continue with executing: efibootmgr -b ' + special['@efi']['number'] + ' -B').then((r) => {
		console.log('Executing efibootmgr -b ' + special['@efi']['number'] + ' -B');
		try {
			const remove = child.execSync('efibootmgr -b ' + special['@efi']['number'] + ' -B');
		} catch(err) {
			console.log('Failed to remove boot entry ' + special['@efi']['number']);
			console.log('This might be a *good* thing, if the boot entry does not exist.');
		}
		pauseReadFromStdin('[KOH] Press enter to continue with executing: efibootmgr -c -d ' + special['@efi']['efi_disk'] + ' -p ' + special['@efi']['efi_partition'] + ' -L ' + special['@efi']['title'] + ' -l ' + special['@efi']['loader'] + ' -u "' + finished + '"').then((r) => {
			console.log('Executing efibootmgr -c -d ' + special['@efi']['efi_disk'] + ' -p ' + special['@efi']['efi_partition'] + ' -L ' + special['@efi']['title'] + ' -l ' + special['@efi']['loader'] + ' -u "' + finished + '"');
			try {
				const create = child.execSync('efibootmgr -c -d ' + special['@efi']['efi_disk'] + ' -p ' + special['@efi']['efi_partition'] + ' -L ' + special['@efi']['title'] + ' -l ' + special['@efi']['loader'] + ' -u "' + finished + '"');
			console.log('Created boot entry ' + special['@efi']['title'] );
			} catch(er) {
				console.log('Failed to create boot entry ' + special['@efi']['title']);
				console.log(er);
				console.log('\n\n\n');
				console.log('DO NOT REBOOT YOUR SYSTEM, UNLESS YOU SEE A BOOT ENTRY IN HERE:');
				child.execSync('efibootmgr');
				console.log('\nIF YOU DO NOT SEE A BOOT ENTRY, YOU MAY NEED TO MANUALLY CREATE IT.');
				console.log('\n\n\n');
			}
		});
	})
}



main();