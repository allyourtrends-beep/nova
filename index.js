export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "Nova Listing Manager",
    message: "Service is running"
  });
}
