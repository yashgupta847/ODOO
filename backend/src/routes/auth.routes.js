const express = require("express");
const router = express.Router();
const authorizeRole = require("../middleware/authorizeRole");
const { supabaseAuth , supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be longer than 8 characters and contain uppercase, lowercase and special characters",
      });
    }

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
        },
      },
    });

    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(201).json({
      message: "Registration successful. Please verify your email if required.",
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});
// Get logged-in user
router.get("/me", verifyToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("full_name, role")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    res.json({
      user: req.user,
      profile
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get(
  "/admin-test",
  verifyToken,
  authorizeRole("admin"),
  (req, res) => {
    res.json({
      message: "Welcome Admin!",
      role: req.userRole,
    });
  }
);
// Customer Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const { data, error } =
      await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return res.status(401).json({
        message: error.message,
      });
    }

    return res.status(200).json({
      message: "Login successful",
      user: data.user,
      session: data.session,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Admin creates Staff account
router.post(
  "/create-staff",
  verifyToken,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { full_name, email, password } = req.body;

      if (!full_name || !email || !password) {
        return res.status(400).json({
          message: "All fields are required",
        });
      }

      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message: "Password must be longer than 8 characters and contain uppercase, lowercase and special characters",
        });
      }

      const { data, error } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name,
          },
        });

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ role: "staff" })
        .eq("id", data.user.id);

      if (profileError) {
        return res.status(500).json({
          message: "Staff created, but role update failed. Contact admin.",
        });
      }

      return res.status(201).json({
        message: "Staff account created successfully",
        user: data.user,
      });

    } catch (error) {
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(
      email
    );

    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.json({
      message: "If the account exists, a password reset email will be sent",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;