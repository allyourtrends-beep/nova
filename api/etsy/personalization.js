import { Redis } from "@upstash/redis";

const ETSY_BASE =
  "https://openapi.etsy.com/v3/application";

const API_KEY = () =>
  `${process.env.ETSY_CLIENT_ID}:${process.env.ETSY_CLIENT_SECRET}`;

function authorized(req) {
  return (
    process.env.NOVA_API_KEY &&
    req.headers.authorization ===
      `Bearer ${process.env.NOVA_API_KEY}`
  );
}

async function refreshToken(redis) {
  const refreshToken =
    await redis.get("etsy_refresh_token");

  if (!refreshToken) {
    throw new Error(
      "Etsy refresh token bulunamadı"
    );
  }

  const response = await fetch(
    "https://api.etsy.com/v3/public/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id:
          process.env.ETSY_CLIENT_ID,
        refresh_token: refreshToken
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Etsy token yenilenemedi: ${JSON.stringify(data)}`
    );
  }

  await redis.set(
    "etsy_access_token",
    data.access_token
  );

  if (data.refresh_token) {
    await redis.set(
      "etsy_refresh_token",
      data.refresh_token
    );
  }

  return data.access_token;
}

async function requestEtsy(
  redis,
  accessToken,
  url,
  options = {}
) {
  const send = (token) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": API_KEY(),
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

  let response = await send(accessToken);

  if (response.status === 401) {
    accessToken =
      await refreshToken(redis);

    response =
      await send(accessToken);
  }

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      `Etsy ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return {
    data,
    accessToken,
    status: response.status
  };
}

async function getShopId(
  redis,
  accessToken
) {
  const result =
    await requestEtsy(
      redis,
      accessToken,
      `${ETSY_BASE}/users/me`
    );

  const shopId =
    result.data?.shop_id;

  if (!shopId) {
    throw new Error(
      "Etsy Shop ID bulunamadı"
    );
  }

  return {
    shopId: Number(shopId),
    accessToken: result.accessToken
  };
}

function cleanQuestion(question) {
  if (
    !question ||
    typeof question !== "object"
  ) {
    throw new Error(
      "Invalid personalization question"
    );
  }

  const allowedTypes = [
    "text_input",
    "dropdown",
    "unlabeled_upload",
    "labeled_upload"
  ];

  const type =
    String(
      question.question_type || ""
    ).trim();

  if (!allowedTypes.includes(type)) {
    throw new Error(
      `Invalid question_type: ${type}`
    );
  }

  const questionText =
    String(
      question.question_text || ""
    ).trim();

  if (
    questionText.length < 1 ||
    questionText.length > 45
  ) {
    throw new Error(
      "question_text must be 1-45 characters"
    );
  }

  const cleaned = {
    question_text: questionText,
    question_type: type,
    required:
      question.required === true
  };

  // Existing questions should retain
  // their Etsy question_id when edited.
  if (
    question.question_id !== undefined &&
    question.question_id !== null
  ) {
    cleaned.question_id =
      Number(question.question_id);
  }

  if (type === "text_input") {
    const max =
      Number(
        question.max_allowed_characters
      );

    if (
      !Number.isInteger(max) ||
      max < 1 ||
      max > 1024
    ) {
      throw new Error(
        "text_input requires max_allowed_characters between 1 and 1024"
      );
    }

    cleaned.max_allowed_characters =
      max;

    if (
      question.instructions !== undefined &&
      question.instructions !== null
    ) {
      const instructions =
        String(
          question.instructions
        ).trim();

      if (instructions.length > 120) {
        throw new Error(
          "instructions must be at most 120 characters"
        );
      }

      if (instructions) {
        cleaned.instructions =
          instructions;
      }
    }

    // Etsy supports optional add-on pricing
    // for text personalization.
    if (
      question.add_on_price !== undefined
    ) {
      if (
        question.add_on_price === null
      ) {
        cleaned.add_on_price = null;
      } else {
        const price =
          Number(
            question.add_on_price
          );

        if (
          !Number.isFinite(price) ||
          price < 0
        ) {
          throw new Error(
            "add_on_price must be a positive number or null"
          );
        }

        cleaned.add_on_price = price;
      }
    }
  }

  if (type === "dropdown") {
    if (
      !Array.isArray(question.options) ||
      question.options.length < 1 ||
      question.options.length > 30
    ) {
      throw new Error(
        "dropdown requires 1-30 options"
      );
    }

    cleaned.options =
      question.options.map(
        (option) => {
          const label =
            String(
              option?.label || ""
            ).trim();

          if (
            label.length < 1 ||
            label.length > 20
          ) {
            throw new Error(
              "dropdown option labels must be 1-20 characters"
            );
          }

          return { label };
        }
      );
  }

  if (
    type === "unlabeled_upload" ||
    type === "labeled_upload"
  ) {
    const maxFiles =
      Number(
        question.max_allowed_files
      );

    if (
      !Number.isInteger(maxFiles) ||
      maxFiles < 1 ||
      maxFiles > 10
    ) {
      throw new Error(
        "upload questions require max_allowed_files between 1 and 10"
      );
    }

    if (
      type === "labeled_upload" &&
      maxFiles < 2
    ) {
      throw new Error(
        "labeled_upload requires at least 2 files"
      );
    }

    cleaned.max_allowed_files =
      maxFiles;

    if (
      question.instructions !== undefined &&
      question.instructions !== null
    ) {
      const instructions =
        String(
          question.instructions
        ).trim();

      if (instructions.length > 120) {
        throw new Error(
          "instructions must be at most 120 characters"
        );
      }

      if (instructions) {
        cleaned.instructions =
          instructions;
      }
    }

    if (type === "labeled_upload") {
      if (
        !Array.isArray(
          question.options
        ) ||
        question.options.length !==
          maxFiles
      ) {
        throw new Error(
          "labeled_upload options count must equal max_allowed_files"
        );
      }

      cleaned.options =
        question.options.map(
          (option) => {
            const label =
              String(
                option?.label || ""
              ).trim();

            if (
              label.length < 1 ||
              label.length > 45
            ) {
              throw new Error(
                "labeled_upload labels must be 1-45 characters"
              );
            }

            return { label };
          }
        );
    }
  }

  return cleaned;
}

export default async function handler(
  req,
  res
) {
  if (!authorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  if (
    !["GET", "POST", "DELETE"].includes(
      req.method
    )
  ) {
    return res.status(405).json({
      ok: false,
      error:
        "GET, POST or DELETE required"
    });
  }

  try {
    const redis =
      Redis.fromEnv();

    let accessToken =
      await redis.get(
        "etsy_access_token"
      );

    if (!accessToken) {
      accessToken =
        await refreshToken(redis);
    }

    const body =
      req.body || {};

    const listingId =
      body.listing_id ||
      req.query?.listing_id;

    if (!listingId) {
      return res.status(400).json({
        ok: false,
        error: "listing_id required"
      });
    }

    // =========================================
    // GET PERSONALIZATION
    // =========================================

    if (req.method === "GET") {
      const result =
        await requestEtsy(
          redis,
          accessToken,
          `${ETSY_BASE}/listings/${Number(
            listingId
          )}/personalization`
        );

      return res.status(200).json({
        ok: true,
        listing_id:
          Number(listingId),
        personalization:
          result.data
      });
    }

    const shop =
      await getShopId(
        redis,
        accessToken
      );

    accessToken =
      shop.accessToken;

    // =========================================
    // DELETE PERSONALIZATION
    // =========================================

    if (req.method === "DELETE") {
      // Additional Nova-side safety lock.
      if (
        body.confirm_delete !== true
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Deleting personalization requires confirm_delete=true"
        });
      }

      await requestEtsy(
        redis,
        accessToken,
        `${ETSY_BASE}/shops/${shop.shopId}/listings/${Number(
          listingId
        )}/personalization`,
        {
          method: "DELETE"
        }
      );

      return res.status(200).json({
        ok: true,
        action:
          "personalization_deleted",
        shop_id: shop.shopId,
        listing_id:
          Number(listingId)
      });
    }

    // =========================================
    // CREATE / UPDATE PERSONALIZATION
    // =========================================

    if (
      !Array.isArray(
        body.personalization_questions
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "personalization_questions array required"
      });
    }

    if (
      body.personalization_questions
        .length < 1 ||
      body.personalization_questions
        .length > 5
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "personalization_questions must contain 1-5 questions"
      });
    }

    const uploadCount =
      body.personalization_questions.filter(
        (question) =>
          question?.question_type ===
            "unlabeled_upload" ||
          question?.question_type ===
            "labeled_upload"
      ).length;

    if (uploadCount > 1) {
      return res.status(400).json({
        ok: false,
        error:
          "Only one upload-type personalization question is allowed"
      });
    }

    const questions =
      body.personalization_questions.map(
        cleanQuestion
      );

    const result =
      await requestEtsy(
        redis,
        accessToken,
        `${ETSY_BASE}/shops/${shop.shopId}/listings/${Number(
          listingId
        )}/personalization?supports_multiple_personalization_questions=true`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            personalization_questions:
              questions
          })
        }
      );

    return res.status(201).json({
      ok: true,
      action:
        "personalization_updated",
      shop_id: shop.shopId,
      listing_id:
        Number(listingId),
      personalization:
        result.data
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        String(error)
    });
  }
}
