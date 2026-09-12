"""
Demo Site — Intentionally Buggy Web Application
================================================
This is a development-only test target for the AI Website Chaos Tester.
It intentionally contains the following seeded bugs:

  BUG-001: Double checkout submission creates duplicate orders
           Trigger: Click 'Pay Now' twice rapidly on /checkout

  BUG-002: Cart count mismatch after page refresh
           Trigger: Add item to cart, refresh /products — count resets in header

  BUG-003: Slow endpoint — /api/slow takes 5 seconds to respond
           Trigger: GET /api/slow

  BUG-004: JavaScript TypeError on 'Apply Promo Code' button
           Trigger: Click 'Apply Promo' on /cart (calls undefined function)

  BUG-005: Broken redirect after logout
           Trigger: POST /logout redirects to /dashboard which does not exist (404)

DO NOT use this site as a real shopping application.
"""
import time
import uuid
from flask import (
    Flask, render_template, request, redirect,
    url_for, session, jsonify, abort
)

app = Flask(__name__)
app.secret_key = "dev-only-not-secret"  # NEVER use this in production

# ── In-memory "database" (resets on restart — intentional for testing) ────────
_orders = []  # list of dicts
_products = [
    {"id": 1, "name": "Widget Pro",  "price": 29.99, "stock": 10},
    {"id": 2, "name": "Gadget Plus", "price": 49.99, "stock": 5},
    {"id": 3, "name": "Doohickey",   "price": 9.99,  "stock": 20},
]


# ── Health check (used by Docker) ─────────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "demo-site"})


# ── Home ───────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", products=_products)


# ── Products ──────────────────────────────────────────────────────────────────
@app.route("/products")
def products():
    return render_template("products.html", products=_products)


@app.route("/products/add", methods=["POST"])
def add_to_cart():
    product_id = int(request.form.get("product_id", 0))
    product = next((p for p in _products if p["id"] == product_id), None)
    if not product:
        abort(404)

    cart = session.get("cart", [])
    # BUG-002: cart stored in session, but header count reads from a different key
    # in the template. After refresh, 'cart_count' key is gone.
    session["cart"] = cart + [product]
    # Intentionally NOT updating 'cart_count' key → mismatch after refresh
    return redirect(url_for("products"))


# ── Cart ───────────────────────────────────────────────────────────────────────
@app.route("/cart")
def cart():
    cart = session.get("cart", [])
    total = sum(item["price"] for item in cart)
    return render_template("cart.html", cart=cart, total=total)


@app.route("/cart/remove", methods=["POST"])
def remove_from_cart():
    product_id = int(request.form.get("product_id", 0))
    cart = session.get("cart", [])
    cart = [item for item in cart if item["id"] != product_id]
    session["cart"] = cart
    return redirect(url_for("cart"))


# ── Checkout ──────────────────────────────────────────────────────────────────
@app.route("/checkout", methods=["GET"])
def checkout():
    cart = session.get("cart", [])
    if not cart:
        return redirect(url_for("products"))
    total = sum(item["price"] for item in cart)
    return render_template("checkout.html", cart=cart, total=total)


@app.route("/checkout", methods=["POST"])
def process_checkout():
    """BUG-001: No idempotency check — submitting twice creates duplicate orders."""
    cart = session.get("cart", [])
    if not cart:
        return redirect(url_for("products"))

    name = request.form.get("name", "")
    email = request.form.get("email", "")
    card = request.form.get("card", "")

    if not name or not email or not card:
        return render_template(
            "checkout.html",
            cart=cart,
            total=sum(item["price"] for item in cart),
            error="All fields are required.",
        )

    # BUG-001: No token check, no idempotency → duplicate orders on double-submit
    order_id = str(uuid.uuid4())[:8].upper()
    order = {
        "id": order_id,
        "items": list(cart),
        "total": sum(item["price"] for item in cart),
        "name": name,
        "email": email,
        "created_at": time.time(),
    }
    _orders.append(order)
    # DO NOT clear the cart → next submit creates another order with same cart
    # session["cart"] = []  # <-- intentionally commented out for BUG-001

    return render_template("order_confirmation.html", order=order, all_orders=_orders)


# ── Orders (admin view for verification) ──────────────────────────────────────
@app.route("/orders")
def orders():
    return jsonify({"orders": _orders, "count": len(_orders)})


# ── Slow endpoint ─────────────────────────────────────────────────────────────
@app.route("/api/slow")
def slow_endpoint():
    """BUG-003: Intentionally slow — 5-second delay."""
    time.sleep(5)
    return jsonify({"status": "ok", "message": "This endpoint is intentionally slow"})


# ── Logout ───────────────────────────────────────────────────────────────────
@app.route("/logout", methods=["POST"])
def logout():
    """BUG-005: Redirects to /dashboard which does not exist."""
    session.clear()
    return redirect(url_for("dashboard"))  # dashboard route does not exist!


# ── Login (simple form, no real auth) ────────────────────────────────────────
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        # Accepts any non-empty credentials — intentionally insecure demo
        if username and password:
            session["user"] = username
            return redirect(url_for("index"))
        return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  DEMO SITE — Intentionally Buggy Web Application")
    print("  FOR DEVELOPMENT / TESTING ONLY")
    print("  Running on http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
