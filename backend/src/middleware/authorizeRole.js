
const { supabaseAdmin } = require("../config/supabase");

const authorizeRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", req.user.id)
        .single();

      if (error || !data) {
        return res.status(403).json({
          message: "User profile not found",
        });
      }

      if (!allowedRoles.includes(data.role)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      req.userRole = data.role;
      next();
    } catch (error) {
      return res.status(500).json({
        message: "Authorization failed",
      });
    }
  };
};

module.exports = authorizeRole;
