{
    'name': 'DSM - Frais de livraison par ville',
    'version': '18.0.1.0.0',
    'category': 'Inventory/Delivery',
    'summary': 'Calcul des frais de livraison selon la ville du client',
    'description': """
Ajoute un mode de tarification « Selon la ville » aux méthodes de livraison :

1. Créer une méthode de livraison avec le fournisseur « Selon la ville »
2. Renseigner la grille : une ligne par ville avec son tarif
3. Le tarif est appliqué automatiquement sur les devis / commandes et
   au checkout eCommerce, selon la ville de l'adresse de livraison
4. Ville introuvable dans la grille : refus de la méthode ou tarif par
   défaut, au choix
5. La livraison gratuite au-dessus d'un montant (champ standard Odoo)
   reste utilisable
    """,
    'author': 'DSM Librairie',
    'depends': ['delivery'],
    'data': [
        'security/ir.model.access.csv',
        'views/delivery_carrier_views.xml',
    ],
    'demo': [
        'demo/delivery_city_demo.xml',
    ],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
