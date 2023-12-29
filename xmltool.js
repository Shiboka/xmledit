const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/***********************************************/
/* Process and validate command line arguments */
/***********************************************/
if(process.argv.length < 3) {
    console.error('Error: No category given.');
    process.exit(1);
}

const confCategory = process.argv[2].toLowerCase();
let confFile;
let skillId;
let skillLink;
let values;

// node xmltool.js skill warrior 10100 hp
if(confCategory == 'skill') {
    if(process.argv.length < 6) {
        console.error('Error: At least 4 arguments are required for skill category.');
        process.exit(1);
    }

    confFile = process.argv[3].toLowerCase();
    skillId = process.argv[4];
    skillLink = process.argv[5].toLowerCase();

    if(skillLink == 'y' || skillLink == 'n') {
        values = process.argv.slice(6)
    } else {
        values = process.argv.slice(5);
        skillLink = 'n';
    }
// node xmltool.js area 1 hp
} else if(confCategory == 'area') {
    if(process.argv.length < 5) {
        console.error('Error: At least 3 arguments are required for area category.');
        process.exit(1);
    }

    confFile = process.argv[3].toLowerCase();
    skillId = process.argv[4];
    skillLink = 'n';


    if(skillId.includes('=')) {
        values = process.argv.slice(4);
        skillId = 'all';
    } else {
        values = process.argv.slice(5)
    }
} else {
    console.error(`Error: ${confCategory} is an invalid category.`);
    process.exit(1);
}

values = values.map(value => {
    if(!value.includes('=')) {
        console.error(`Error: Invalid value given: ${value}`);
        process.exit(1);
    }

    return value.split('=');
});

/**********************************************/

/************************/
/* Function Definitions */
/************************/
function editSkill($, file, id, attribute, value) {
    $('SkillData').find('Skill').each((i, e) => {
        if($(e).attr('id') == id) {
            let changed = false;

            if(attribute == "mp" || attribute == "hp" || attribute == "anger") {
                $(e).find('TargetingList').each((i, e) => {
                    $(e).find('Targeting').each((i,e) => {
                        $(e).find('Cost').each((i,e) => {
                            if($(e).attr(attribute) != undefined) {
                                value = parseInt(value);
                                $(e).attr(attribute, value);
                                changed = true;
                            }
                        });
                    });
                });

                $(e).find('Precondition').each((i, e) => {
                    $(e).find('Cost').each((i, e) => {
                        if($(e).attr(attribute) != undefined) {
                            value = parseInt(value);
                            $(e).attr(attribute, value);
                            changed = true;
                        }
                    });
                });
            } else if(attribute == 'coolTime') {
                $(e).find('Precondition').each((i, e) => {
                    if($(e).attr(attribute) != undefined) {
                        value = parseInt(value);
                        $(e).attr(attribute, value);
                        changed = true;
                    }
                });
            } else if(attribute == 'startCancelEndTime' || attribute == 'rearCancelStartTime' || attribute == 'moveCancelStartTime') {
                $(e).find('Action').each((i, e) => {
                    $(e).find('Cancel').each((i, e) => {
                        if($(e).attr(attribute) != undefined) {
                            value = parseInt(value);
                            $(e).attr(attribute, value);
                            changed = true;
                        }
                    });
                });
            } else if(attribute == "totalAtk" || attribute == "timeRate" || attribute == 'attackRange') {
                if($(e).attr(attribute) != undefined) {
                    $(e).attr(attribute, value);
                    changed = true;
                }
            }

            if(changed) {
                console.log(`Changed skill id ${id} ${attribute}="${value}" in file: ${file}`);
            }
        }
    });
}

function editSkills(err, files, dir, conf) {
    if(err) {
        console.error(`Error: Could not open directory: ${dir}`);
        process.exit(1);
    };

    files.forEach(file => {
        const filePath = path.join(dir, file);

        fs.readFile(filePath, 'utf8', (err, data) => {
            if(err) {
                console.error(`Error: Could not open file: ${filePath}`)
                process.exit(1);
            }

            var $ = cheerio.load(data, { xmlMode: true, decodeEntities: false });

            values.forEach(value => {
                editSkill($, file, skillId, value[0], value[1]);

                if(skillLink == 'y') {
                    conf.Skills[skillId].forEach((skill, i) => {
                        const baseFloat = parseFloat(value[1]);
                        const modFloat = parseFloat(conf.Attributes[value[0]][skillId][i]);
                        const modifiedValue = baseFloat + baseFloat * modFloat;
                        
                        editSkill($, file, skill, value[0], modifiedValue.toFixed(2));
                    });
                }
            });

            fs.writeFile(filePath, $.xml(), err => { if(err) throw err });
        });
    });
}

function editNpcStat($, e, attribute, value, area) {
    let modifiedValue;

    if(area && (value[0] != '+' && value[0] != '-')) {
        console.error(`Error: Only percentages are allowed for area edits.`)
        process.exit(1);
    }

    if(attribute == 'str' || attribute == 'res') {
        $(e).find('Critical').each((i, e) => {
            if($(e).attr(attribute) != undefined) {
                if(value[0] == '+' || value[0] == '-') {
                    const base = parseFloat($(e).attr(attribute));
                    const modifier = parseFloat(value);
                    modifiedValue = base + base * modifier;
                } else {
                    modifiedValue = value;
                }


                modifiedValue = parseInt(modifiedValue)
                $(e).attr(attribute, modifiedValue);
            }
        });
    } else {
        $(e).find('Stat').each((i, e) => {
            if($(e).attr(attribute) != undefined) {
                if(value[0] == '+' || value[0] == '-') {
                    const base = parseFloat($(e).attr(attribute));
                    const modifier = parseFloat(value);
                    modifiedValue = base + base * modifier;
                } else {
                    modifiedValue = value;
                }

                if(attribute == 'atk' || attribute == 'def') {
                    modifiedValue = parseInt(modifiedValue)
                    $(e).attr(attribute, modifiedValue);
                } else {
                    modifiedValue = parseFloat(modifiedValue).toFixed(2);
                    $(e).attr(attribute, modifiedValue);
                }
            }
        });
    }

    return modifiedValue;
}

function editArea(err, files, dir) {
    if(err) {
        console.error(`Error: Could not open directory: ${dir}`);
        process.exit(1);
    };

    files.forEach(file => {
        const filePath = path.join(dir, file);

        fs.readFile(filePath, 'utf8', (err, data) => {
            if(err) {
                console.error(`Error: Could not open file: ${filePath}`)
                process.exit(1);
            }

            var $ = cheerio.load(data, { xmlMode: true, decodeEntities: false });

            values.forEach(value => {
                if(value[0] != 'maxHp' && value[0] != 'atk' && value[0] != 'def' && value[0] != 'str' && value[0] != 'res') {
                    console.error(`Error: Unsupported attribute ${value[0]}.`);
                    process.exit(1);
                }

                $('NpcData').find('Template').each((i, e) => {
                    let modifiedValue;

                    if(skillId == 'all') {
                        modifiedValue = editNpcStat($, e, value[0], value[1], true);
                    } else if(skillId == 'small') {
                        if($(e).attr('size') == 'small') {
                            modifiedValue = editNpcStat($, e, value[0], value[1], true);
                        }
                    } else if(skillId == 'medium') {
                        if($(e).attr('size') == 'medium') {
                            modifiedValue = editNpcStat($, e, value[0], value[1], true);
                        }
                    } else if(skillId == 'large') {
                        if($(e).attr('size') == 'large') {
                            modifiedValue = editNpcStat($, e, value[0], value[1], true);
                        }
                    } else if(skillId == 'elite') {
                        if($(e).attr('elite').toLowerCase() == 'true') {
                            modifiedValue = editNpcStat($, e, value[0], value[1], true);
                        }
                    } else {
                        if(!skillId.includes('-')) {
                            console.error(`Error: Invalid id ${skillId}.`);
                            process.exit(1);
                        }
                        
                        const ids = skillId.split('-');

                        if($('NpcData').attr('huntingZoneId') == ids[0] && $(e).attr('id') == ids[1]) {
                            modifiedValue = editNpcStat($, e, value[0], value[1], false);
                        }
                    }

                    if(modifiedValue != undefined) {
                        console.log(`Changed npc ${$(e).attr('id')} ${value[0]}="${modifiedValue}" in file: ${file}`);
                    }
                });
            });

            fs.writeFile(filePath, $.xml(), err => { if(err) throw err });
        });
    });
}

/*************************************************/

/**************************************/
/* Read conf file and begin execution */
/**************************************/
fs.readFile(`conf/${confCategory}/${confFile}.json`, 'utf8', (err, data) => {
    if(err) {
        console.error(`Error: conf/${confCategory}/${confFile}.json does not exist.`);
        process.exit(1);
    };

    const conf = JSON.parse(data);
    const datasheetPath = conf.Datasheet;
    const databasePath = conf.Database;

    if(confCategory == 'skill') {
        // Validate conf file if Y given
        if(skillLink == "y") {
            if(conf.Skills[skillId] == undefined) {
                console.error(`Error: Invalid conf. Y given but no skill chain specified for Skill ID "${skillId}" in the conf.`);
                process.exit(1);
            }

            values.forEach(value => {
                if(conf.Attributes[value[0]] == undefined) {
                    console.error(`Error: Invalid conf. Y given but no Attribute "${value[0]}" specified in the conf.`);
                    process.exit(1);
                }

                if(conf.Attributes[value[0]][skillId] == undefined) {
                    console.error(`Error: Invalid conf. Y given but no Skill ID "${skillId}" specified for Attribute "${value[0]}" in the conf.`)
                    process.exit(1);
                }

                if(conf.Attributes[value[0]][skillId].length != conf.Skills[skillId].length) {
                    console.error(`Error: Invalid conf. Y given but length of list for "${value[0]}" does not equal length of list for Skill ID "${id}" in the conf.`);
                    process.exit(1);
                }
            });
        }

        fs.readdir(datasheetPath, (err, files) => editSkills(err, files, datasheetPath, conf));
        fs.readdir(databasePath, (err, files) => editSkills(err, files, databasePath, conf));
    } else if(confCategory == 'area') {
        fs.readdir(datasheetPath, (err, files) => editArea(err, files, datasheetPath));
        fs.readdir(databasePath, (err, files) => editArea(err, files, databasePath));    
    }
});

/*****************************************************/ 