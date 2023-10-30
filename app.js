//jshint esversion:6

require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://0.0.0.0:27017/userDB");

// console.log(process.env.API_KEY);

const userSchema = new mongoose.Schema({
  user: String,
  password: String,
  googleId: String,
  secret: String,
});

// userSchema.plugin(encrypt, {
//   secret: process.env.SECRET,
//   encryptedFields: ["password"],
// });

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture,
    });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/login", function (req, res) {
  // const username = req.body.username;
  // // const password = req.body.password;
  // const password = req.body.password;
  // User.findOne({ user: username }).then(function (found) {
  //   if (found) {
  //     bcrypt.compare(password, found.password, function (err, result) {
  //       // result == true
  //       if (result == true) res.render("secrets");
  //     });
  //   }
  // });

  const newUser = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(newUser, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/secrets", function (req, res) {
  // if (req.isAuthenticated()) res.render("secrets");
  // else res.redirect("/login");

  User.find({ secret: { $ne: null } }).then(function (found) {
    if (found) {
      res.render("secrets", { userWithSecrets: found });
    }
  });
});

app.post("/submit", function (req, res) {
  const submittedSecret = req.body.secret;
  console.log(req.user.id);
  User.findById(req.user.id).then(function (found) {
    if (found) {
      found.secret = submittedSecret;
      found.save().then(function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) res.render("submit");
  else res.redirect("/login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {
  // bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
  //   // Store hash in your password DB.
  //   const newUser = new User({
  //     user: req.body.username,
  //     // password: req.body.password,
  //     password: hash,
  //   });
  //   newUser.save().then(function () {
  //     res.render("secrets");
  //   });
  // });
  // // const newUser = new User({
  // //   user: req.body.username,
  // //   // password: req.body.password,
  // //   password: md5(req.body.password),
  // // });

  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) console.log(err);
    else res.redirect("/");
  });
});

app.listen(3000, function (req, res) {
  console.log("Successfully running server on port 3000");
});
