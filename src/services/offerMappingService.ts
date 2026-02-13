/**
 * Offer Mapping Service
 * Maps sub parameters to final URLs for offers
 */

interface OfferMapping {
    sub1: string;
    finalUrl: string;
    description?: string;
}

export class OfferMappingService {
    // Мапінг sub1 → final_url
    // Це можна винести в БД або конфіг файл
    private offerMappings: OfferMapping[] = [
        {
            sub1: 'organic',
            finalUrl: 'https://hudesatraff.com/6sF5GMLb?sub1=organic&af_userid={os_user_key}&push={push_sub}&bundle={bundle}',
            description: 'Organic traffic offer',
        },
        // Додати інші маппінги
        // {
        //     sub1: 'campaign1',
        //     finalUrl: 'https://offer1.com?...',
        //     description: 'Campaign 1 offer'
        // },
    ];

    /**
     * Get final URL by sub1 parameter
     */
    getFinalUrlBySub1(sub1: string | null): string | null {
        if (!sub1) {
            // Default organic offer
            return this.getOrganicOffer();
        }

        const mapping = this.offerMappings.find((m) => m.sub1 === sub1);

        if (mapping) {
            return mapping.finalUrl;
        }

        // Fallback to organic if no mapping found
        return this.getOrganicOffer();
    }

    /**
     * Get organic offer URL
     */
    private getOrganicOffer(): string {
        const organicMapping = this.offerMappings.find((m) => m.sub1 === 'organic');
        return (
            organicMapping?.finalUrl ||
            'https://hudesatraff.com/6sF5GMLb?sub1=organic&af_userid={os_user_key}&push={push_sub}'
        );
    }

    /**
     * Inject dynamic parameters into final URL
     */
    injectParams(
        finalUrl: string,
        params: {
            os_user_key: string;
            push_sub: string;
            bundle?: string;
            app_id?: string;
            [key: string]: string | undefined;
        }
    ): string {
        let url = finalUrl;

        // Replace placeholders with actual values
        url = url.replace('{os_user_key}', params.os_user_key);
        url = url.replace('{push_sub}', params.push_sub);
        url = url.replace('{af_userid}', params.os_user_key); // Alias for os_user_key

        if (params.bundle) {
            url = url.replace('{bundle}', params.bundle);
        }

        if (params.app_id) {
            url = url.replace('{app_id}', params.app_id);
        }

        // Replace any remaining placeholders with empty string
        url = url.replace(/\{[^}]+\}/g, '');

        return url;
    }

    /**
     * Add offer mapping (for dynamic configuration)
     */
    addOfferMapping(sub1: string, finalUrl: string, description?: string): void {
        this.offerMappings.push({ sub1, finalUrl, description });
    }

    /**
     * Get all offer mappings
     */
    getAllMappings(): OfferMapping[] {
        return this.offerMappings;
    }
}

export default new OfferMappingService();
