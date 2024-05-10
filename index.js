import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import env from "dotenv";
import GoogleStrategy from "passport-google-oauth2";



const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

// Set session expiration time to 30 minutes (adjust as needed)
const sessionExpirationTime = 30 * 60 * 1000; // 30 minutes in milliseconds

app.use( session({
  secret:"TOPSECRETWORD",
  resave: false,
  saveUninitialized:true,
  cookie: {
    maxAge: sessionExpirationTime
  }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "streetfood",
  password: process.env.password,
  port: 5432,
});
db.connect((err) => {
  if (err) {
    console.error("Error connecting to database", err.stack);
    return;
  }
  console.log("Connected to database");
});

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("loginregister.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const phoneno = req.body.number;

  try {
    const checkResult = await db.query(
      "SELECT * FROM userloginregister WHERE emailid = $1",
      [email]
    );

    if (checkResult.rows.length > 0) {
      // res.send("Email already exists. Try logging in.");
      res.redirect("/login");
    } else {
      //hashing the password and saving it in the database
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          console.log("Hashed Password:", hash);
          const result = await db.query(
            "INSERT INTO userloginregister (emailid,phonenumber,password) VALUES ($1, $2, $3) RETURNING *",
            [email, phoneno, hash]
          );
          console.log(result);

          const user = result.rows[0];
          console.log(result.rows[0]);

          req.login(user, (err) => {
            console.log(result);

            console.log("success");
            res.redirect("/mainpage");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/mainpage",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/mainpage",
    failureRedirect: "/login",
  })
);

app.get("/mainpage", async (req, res) => {
  //console.log(req.user);

  if (req.isAuthenticated()) {
    try {
      const result = await db.query(
        `SELECT * FROM food1 ORDER BY overall_rating DESC;`
      );
      const i = result.rows;
      // console.log(i);
      console.log(req.user);
      res.render("index.ejs", { street: i, username: req.user.name });
      // res.json(i);
    } catch (error) {
      console.error("Error executing query", error.stack);
      res.status(500).send("Internal Server Error");
    }
  } else {
    return res.redirect("/login");
  }
});

app.get("/add", async (req, res) => {
  try {
    res.render("add.ejs");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

//getting all top rated by city name by area name by food/menu

app.get("/bycitybyareabyfood", async (req, res) => {
  try {
    const cityname = req.query.city;
    const cityfood = req.query.fooditem;
    const cityarea = req.query.area;
    const store = req.query.storename;

    console.log(cityname);
    console.log(cityfood);
    console.log(cityarea);
    console.log(store);

    //const queryString = `SELECT * FROM food WHERE city = '${cityname}' OR area = '${cityarea}' OR food_item = '${cityfood}' OR store_name = '${store}' ORDER BY overall_rating DESC;`;

    // const queryString = `SELECT * FROM food WHERE (city = '${cityname}' AND area = '${cityarea}') OR (city = '${cityname}' AND food_item = '${cityfood}') OR ( city = '${cityname}'AND store_name = '${store}') ORDER BY overall_rating DESC;`;

    let params = [cityname];

    let queryString = `SELECT * FROM food1 WHERE city = $1`;

    if (cityfood) {
      queryString += ` AND food_item = $${params.length + 1}`;
      params.push(cityfood);
    }

    if (cityarea) {
      queryString += ` AND area = $${params.length + 1}`;
      params.push(cityarea);
    }
    if (store) {
      queryString += ` AND store_name = $${params.length + 1}`;
      params.push(store);
    }

    queryString += ` ORDER BY overall_rating DESC`;

    //const result = await db.query(queryString);
    const result = await db.query(queryString, params);
    const i = result.rows;

    // Send response with the retrieved data
    res.render("index.ejs", { street: i });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }
});

/////////////////////////////////////////////////////////////
app.get("/showdetial", async (req, res) => {
  const shop = req.query.id;

  try {
    const result = await db.query(`SELECT * FROM food1 where id = $1;`, [shop]);

    const i = result.rows;
    console.log(i);
    // console.log(i);
    res.render("review.ejs", { street: i });
    // res.json(i);
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }

  //res.render("review.ejs",{id:shop});
});

//////
app.get("/addrating", async (req, res) => {
  const shop = req.query.storeid;

  res.render("rating.ejs", { id: shop });
});

app.post("/rate", async (req, res) => {
  try {
    const storeid = req.body.storeid;
    const new_rating = parseFloat(req.body.given_rating);
    console.log(storeid);
    console.log(new_rating);
    const previous_rating = await db.query(
      `SELECT overall_rating FROM food1 WHERE id = $1`,
      [storeid]
    );
    const previous_rating_value = parseFloat(
      previous_rating.rows[0].overall_rating
    );
    console.log("previous-rating", previous_rating_value);
    const average_rating = (new_rating + previous_rating_value) / 2;
    console.log("average rating=", average_rating);

    const update_query = await db.query(
      `UPDATE food1 SET overall_rating = $1 WHERE id = $2;`,
      [average_rating, storeid]
    );

    console.log("upadate_query", update_query);
    res.redirect("/mainpage");
    //res.status(200).send({ success: true, message: "Rating updated successfully" });
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
});
// ??????????????????????????????????????????????
app.get("/localtest", async (req, res) => {
  res.render("test.ejs");
});
////////////////////////////////////////////////////////////
app.post("/insert", async (req, res) => {
  try {
    const cityname = req.body["city"];
    const cityarea = req.body["area"];
    const cityfood = req.body["fooditem"];
    const store = req.body["storename"];
    const rating = req.body["rating"];

    console.log(cityarea);
    console.log(cityfood);
    console.log(cityname);
    console.log(store);
    console.log(rating);

    // Assuming you have a connection to your MySQL database named `connection`

    const query =
      "INSERT INTO food1 (store_name, city, area, food_item, overall_rating) VALUES ($1, $2, $3, $4, $5)";
    db.query(
      query,
      [store, cityname, cityarea, cityfood, rating],
      (error, results, fields) => {
        if (error) {
          console.error("Error inserting data:", error);
          // Handle error
        } else {
          console.log("Data inserted successfully:", results);
          // Handle success
        }
      }
    );
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cd) {
    try {
      const result = await db.query(
        "SELECT * FROM userloginregister WHERE emailid = $1",
        [username]
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        //verifying the password
        bcrypt.compare(password, storedHashedPassword, (err, result) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cd(err);
          } else {
            if (result) {
              //Passed password check
              return cd(null, user);
            } else {
              //Did not pass password check
              return cd(null, false);
            }
          }
        });
      } else {
        return cd("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        //console.log(profile);
        const result = await db.query(
          "SELECT * FROM userloginregister WHERE emailid = $1",
          [profile.email]
        );
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO userloginregister (emailid, phonenumber, password, name, username, profile_photo) VALUES ($1,$2,$3,$4,$5,$6)",
            [
              profile.email,
              profile.provider,
              profile.provider,
              profile.given_name,
              profile.family_name,
              profile.picture,
            ]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
