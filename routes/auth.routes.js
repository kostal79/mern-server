const Router = require("express");
const User = require("../models/user.js");
const router = new Router();
const bcrypt = require("bcryptjs");
const { check, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const config = require("config");
const authMiddleware = require("../middleware/auth.middleware")
const fileService = require("../services/fileService")
const File = require("../models/file")

router.post("/registration", [
    check("email", "Incorrect email").isEmail(),
    check("password", "Password must be longer than 3 and shorter than 12").isLength({ min: 3, max: 12 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: "Uncorrect request", errors })
        }
        const { email, password } = req.body;
        const candidate = await User.findOne({ email });
        if (candidate) {
            return res.status(400).json({ message: `User with email ${email} already exists` })
        }
        const hashPassword = await bcrypt.hash(password, 7);
        const user = new User({ email: email, password: hashPassword });
        await user.save();
        console.log("user:  ", user)
        await fileService.createDir(req, new File({user: user.id, name: ""}))
        return res.json({ message: `User ${email} was created` })

    } catch (error) {
        console.log(error)
        res.send({ message: "Server error" })
    }
})

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: `User ${email} don't exist` })
        }

        const isPassValid = bcrypt.compare(password, user.password);
        if (!isPassValid) {
            return res.status(404).json({ message: "Invalid password" })
        }

        const token = jwt.sign({ id: user.id }, config.get("secretKey"), { expiresIn: "24h" });

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                diskSpace: user.discSpace,
                usedSpace: user.usedSpace,
                avatar: user.avatar
            }
        })

    } catch (error) {
        console.log(error)
        res.send({ message: "Server error" })
    }
})

router.get("/auth", authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.user.id })
        const token = jwt.sign({ id: user.id }, config.get("secretKey"), { expiresIn: "24h" });

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                diskSpace: user.discSpace,
                usedSpace: user.usedSpace,
                avatar: user.avatar
            }
        })

    } catch (error) {
        console.log(error)
        res.send({ message: "Server error" })
    }
})

module.exports = router