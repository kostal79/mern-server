const User = require("../models/user")
const File = require("../models/file");
const config = require("config")
const fileService = require("../services/fileService");
const fs = require("fs");
const uuid = require("uuid")

class FileController {
    async createDir(req, res) {
        try {
            const { name, type, parent } = req.body;
            const file = new File({ name, type, parent, user: req.user.id })
            const parentFile = await File.findOne({ _id: parent });
            if (!parentFile) {
                file.path = name;
                await fileService.createDir(req, file);
            } else {
                file.path = `${parentFile.path}/${file.name}`;
                await fileService.createDir(req, file);
                parentFile.childs.push(file._id);
                await parentFile.save()
            }
            await file.save();
            return res.json(file)

        } catch (error) {
            console.log(error);
            return res.status(400).json(error)
        }
    }

    async fetFiles(req, res) {
        try {
            let files = await File.find({ user: req.user.id, parent: req.query.parent });
            switch (req.query.sort) {
                case "name":

                    files.sort(function (a, b) {
                        if (a.name.toLowerCase() > b.name.toLowerCase()) {
                            return 1
                        } else if (a.name.toLowerCase() < b.name.toLowerCase()) {
                            return -1
                        } else {
                            return 0
                        }
                    });
                    break;
                case "type":
                    files.sort(function (a, b) {
                        if (a.type === "dir" && b.type !== "dir") {
                            return -1
                        } else if (a.type !== "dir" && b.type === "dir") {
                            return 1
                        } else if (a.type === "dir" && b.type === "dir") {
                            return 0
                        } else {
                            if (a.type > b.type) {
                                return 1
                            } else if (a.type < b.type) {
                                return -1
                            } else {
                                return 0
                            }
                        }
                    });
                    break;
                case "date":
                    files.sort(function (a, b) {
                        return a - b
                    });
                    break;
                default:
                    break;
            }

            return res.json(files)
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: "Can not get file" })
        }
    }

    async uploadFile(req, res) {
        try {
            const file = req.files.file;
            const parent = await File.findOne({ user: req.user.id, _id: req.body.parent });
            const user = await User.findOne({ _id: req.user.id });

            if (user.usedSpace + file.size > user.discSpace) {
                return res.status(400).json({ message: "There is no space on the disk" })
            }

            user.usedSpace = user.usedSpace + file.size;

            let path;
            if (parent) {
                path = `${req.filePath}/${user._id}/${parent.path}/${file.name}`
            } else {
                path = `${req.filePath}/${user._id}/${file.name}`
            }

            if (fs.existsSync(path)) {
                return res.status(500).json({ message: "File already exists" })
            }

            file.mv(path);

            const fileType = file.name.split(".").at(-1);
            let filePath = file.name;
            if (parent) {
                filePath = `${parent.path}/${file.name}`
            }
            const dbFile = new File({
                name: file.name,
                type: fileType,
                size: file.size,
                path: filePath,
                parent: parent ? parent._id : null,
                user: user._id
            })

            await dbFile.save();
            await user.save();
            res.json(dbFile);

        } catch (error) {
            console.log(error)
            return res.status(400).json({ message: "Upload error" })
        }
    }

    async downloadFile(req, res) {
        try {
            const file = await File.findOne({ _id: req.query.id, user: req.user.id });
            const path = fileService.getPath(req, file);
            if (fs.existsSync(path)) {
                return res.download(path, file.name)
            }
            return res.status(400).json({ message: "Download error with path" })

        } catch (error) {
            console.log(error);
            return res.status(400).json({ message: "Download error in fileController" });
        }
    }

    async deleteFile(req, res) {
        try {
            const file = await File.findOne({ _id: req.query.id, user: req.user.id })
            if (!file) {
                return res.status(400).json({ message: "File not found" })
            }
            fileService.deleteFile(req, file);
            await file.remove();
            return res.json({ message: "File was deleted" })
        } catch (error) {
            console.log(error);
            return res.status(400).json({ message: "Dir is not empty" })
        }
    }

    async searchFile(req, res) {
        try {
            const searchName = req.query.search;
            let files = await File.find({user: req.user.id});
            files = files.filter(file => file.name.includes(searchName))
            return res.json(files)
            
        } catch (error) {
            console.log(error)
            return res.status(400).json({ message: "Search error" })

        }
    }

    async uploadAvatar(req, res) {
        try {
            const file = req.files.file;
            const user = await User.findById(req.user.id)
            const avatarName = uuid.v4() + ".jpg"
            file.mv(`${config.get("staticPath")}/${avatarName}`)
            user.avatar = avatarName;
            await user.save();
            return res.json(user)
        } catch (error) {
            console.log(error)
            return res.status(400).json({ message: "Upload avatar error" })
        }
    }

    async deleteAvatar(req, res) {
        try {
            const user = await User.findById(req.user.id)
            fs.unlinkSync(`${config.get("staticPath")}/${user.avatar}`)
            user.avatar = null;
            await user.save();
            return res.json(user)
        } catch (error) {
            console.log(error)
            return res.status(400).json({ message: "Delete avatar error" })

        }
    }
}

module.exports = new FileController()