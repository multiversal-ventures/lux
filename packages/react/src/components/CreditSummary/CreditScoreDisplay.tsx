import type { CreditScore } from "@multiversal-ventures/lux-core";
import styles from "./CreditSummary.module.css";

export interface CreditScoreDisplayProps {
	scores: CreditScore[];
}

export function CreditScoreDisplay({ scores }: CreditScoreDisplayProps) {
	if (scores.length === 0) return null;

	return (
		<div className={styles.scoresCard}>
			<h3 className={styles.cardTitle}>Credit Scores</h3>
			<div className={styles.scoresGrid}>
				{scores.map((score, idx) => {
					const colorClass =
						score.score >= 700
							? styles.scoreGood
							: score.score >= 620
								? styles.scoreFair
								: styles.scorePoor;

					return (
						<div key={idx} className={styles.scoreItem}>
							<div className={styles.scoreModel}>{score.score_model}</div>
							{score.score ? (
								<div className={`${styles.scoreValue} ${colorClass}`}>{score.score}</div>
							) : (
								<div className={styles.scoreNoValue}>
									{score.no_score_reason ?? "No score"}
								</div>
							)}
							{score.reason_codes && (
								<div className={styles.scoreCodes} title={score.reason_codes}>
									{score.reason_codes}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
