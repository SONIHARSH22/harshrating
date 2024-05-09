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
app.use( session({
  secret:"TOPSECRETWORD",
  resave: false,
  saveUninitialized:true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === "production") {
  // Use Render database configuration
  db = new Client({
    connectionString: process.env.RENDER_POSTGRESQL_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
} else {
  // Use local database configuration
  db = new Client({
    user: "postgres",
    host: "localhost",
    database: "streetfood",
    password: process.env.LOCAL_DB_PASSWORD, // Set this environment variable locally
    port: 5432,
  });
}
db.connect((err) => {
  if (err) {
    console.error("Error connecting to database", err.stack);
    return;
  }
  console.log("Connected to database");
});


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
    const checkResult = await db.query("SELECT * FROM userloginregister WHERE emailid = $1", [email]);

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
            [email,phoneno,hash]
          );
          console.log(result);

          const user = result.rows[0];
          console.log(result.rows[0]);

          req.login(user,(err)=>{
            console.log(result);

            console.log("success");
            res.redirect("/mainpage");
          })
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


app.post("/login",passport.authenticate("local",{
  successRedirect:"/mainpage",
  failureRedirect: "/login"
}));




app.get("/mainpage", async (req, res) => {
  console.log(req.user);

  if(req.isAuthenticated()){
  try {
    const result = await db.query(
      `SELECT * FROM food1 ORDER BY overall_rating DESC;`
    );
    const i = result.rows;
    // console.log(i);
    res.render("index.ejs", { street: i });
    // res.json(i);
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }

}
else{
  return res.redirect("/login")
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
      
      queryString += ` AND food_item = $${params.length+1}`;
      params.push(cityfood);
    }
    
    if (cityarea) {
      
      queryString += ` AND area = $${params.length+1}`;
      params.push(cityarea);
    };
    if (store) {
      
      queryString += ` AND store_name = $${params.length+1}`;
      params.push(store);
    }
  
    queryString += ` ORDER BY overall_rating DESC`;

    //const result = await db.query(queryString);
    const result = await db.query(queryString,params);
    const i = result.rows;

    // Send response with the retrieved data
    res.render("index.ejs", { street: i });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }
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
    
    const query = "INSERT INTO food1 (store_name, city, area, food_item, overall_rating) VALUES ($1, $2, $3, $4, $5)";
    db.query( query,[store, cityname, cityarea, cityfood, rating],
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

passport.use("local",
  new Strategy(async function verify(username, password, cd){
   
  try {
    const result = await db.query("SELECT * FROM userloginregister WHERE emailid = $1", [
      username,]);
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
            return cd(null,user);
          } else {
            //Did not pass password check
            return cd(null, false)
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
    },
    async (accessToken, refreshToken, profile, cb) => {
      
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM userloginregister WHERE emailid = $1", [
          profile.email,]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO userloginregister (emailid, phonenumber, password) VALUES ($1, $2)",
            [profile.email, "google phone", "google"]
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
