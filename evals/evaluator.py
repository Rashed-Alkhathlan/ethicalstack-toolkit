import logging
from litellm import completion
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMEvaluator:
    def __init__(self, target_model: str, judge_model: str, fallback_judge_model: str = None):
        self.target_model = target_model
        self.judge_model = judge_model
        self.fallback_judge_model = fallback_judge_model

    def generate_explanation(self, term: str) -> str:
        prompt = f"Explain this AI related concept '{term}' in Arabic and in 1 - 2 sentences."
        try:
            response = completion(
                model=self.target_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=1.0
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error generating explanation for '{term}': {e}")
            return ""

    def score_explanation(self, term: str, generated_explanation: str, ground_truth: str) -> int:
        prompt = (
            f"You are an expert AI linguistics judge. Your task is to evaluate an Arabic explanation of the AI concept '{term}'.\n\n"
            f"Ground truth definition:\n{ground_truth}\n\n"
            f"Target model's explanation:\n{generated_explanation}\n\n"
            f"Please score the target model's explanation on a scale of 1 to 5 based on semantic similarity and accuracy compared to the ground truth.\n"
            f"Criteria:\n"
            f"5 - Excellent: Captures the core meaning and essence perfectly, even if using different wording, synonyms, or adding helpful context.\n"
            f"4 - Good: Mostly accurate but misses a minor nuance from the ground truth.\n"
            f"3 - Fair: Captures the general idea but misses key components.\n"
            f"2 - Poor: Barely related or contains significant inaccuracies.\n"
            f"1 - Incorrect: Completely wrong or irrelevant.\n\n"
            f"Only return a single integer between 1 and 5. Do not provide any other text."
        )
        
        models_to_try = [self.judge_model]
        if self.fallback_judge_model:
            models_to_try.append(self.fallback_judge_model)
            
        for model in models_to_try:
            try:
                response = completion(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=1.0
                )
                score_str = response.choices[0].message.content.strip()
                # Extract the first digit just in case
                import re
                match = re.search(r'\d+', score_str)
                if match:
                    score = int(match.group())
                    return min(max(score, 1), 5) # Ensure it's between 1 and 5
                return -1
            except Exception as e:
                logger.warning(f"Error scoring with model {model}: {e}")
                if "rate limit" in str(e).lower() and model != models_to_try[-1]:
                    logger.info("Rate limit hit, trying fallback model...")
                    continue
                return -1
        return -1
